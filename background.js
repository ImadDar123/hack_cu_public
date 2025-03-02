// Initialize context menu on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "findSource",
    title: "Find source for this text",
    contexts: ["selection"]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "findSource" && info.selectionText) {
    findSourceForText(info.selectionText, tab.id);
  }
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "findSource") {
    // If the message comes from the popup, we need to get the active tab
    if (!sender.tab) {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs && tabs[0]) {
          findSourceForText(request.text, tabs[0].id);
          sendResponse({status: "processing"});
        }
      });
    } else {
      // If it comes from a content script, use the sender's tab ID
      findSourceForText(request.text, sender.tab.id);
      sendResponse({status: "processing"});
    }
  }
});

// Add this function to check if the server is running
async function checkServerStatus() {
  try {
    console.log("Checking server status...");
    const response = await fetch("http://localhost:5002/", {
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    });
    
    console.log("Server status response:", response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log("Server health check response:", data);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error("Server check failed:", error);
    return false;
  }
}

// Modify the findSourceForText function to check server status first
async function findSourceForText(text, tabId) {
  try {
    console.log("Finding source for:", text, "in tab:", tabId);
    
    // Make sure the content script is loaded before sending messages
    await ensureContentScriptLoaded(tabId);
    
    // Show loading state
    if (tabId) {
      chrome.tabs.sendMessage(tabId, { action: "showLoading" }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Error sending showLoading message:", chrome.runtime.lastError);
        }
      });
    }
    
    // Check if the server is running
    const serverRunning = await checkServerStatus();
    if (!serverRunning) {
      throw new Error("The verification server is not running. Please start the Flask server.");
    }
    
    // Call the Flask API to verify the text
    const result = await callVerificationAPI(text);
    
    // Send results back to content script
    if (tabId) {
      chrome.tabs.sendMessage(tabId, { 
        action: "showResults",
        decision: result.verdict,
        summary: result.summary,
        sources: result.sources.map(source => source.url)
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Error sending showResults message:", chrome.runtime.lastError);
        }
      });
    }
    
    // Store the search in history
    storeSearchHistory(text, result.sources.map(source => source.url));
    
  } catch (error) {
    console.error("Error finding sources:", error);
    
    let errorMessage = "Failed to find sources. Please try again.";
    
    // Provide more specific error messages
    if (error.message.includes("server is not running")) {
      errorMessage = "The verification server is not running. Please start the Flask server.";
    } else if (error.message.includes("NetworkError") || error.message.includes("Failed to fetch")) {
      errorMessage = "Network error: Could not connect to the verification server.";
    } else if (error.message.includes("API request failed")) {
      errorMessage = "Server error: " + error.message;
    }
    
    if (tabId) {
      chrome.tabs.sendMessage(tabId, { 
        action: "showError", 
        message: errorMessage
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Error sending showError message:", chrome.runtime.lastError);
        }
      });
    }
  }
}

// Call the Flask API to verify text
async function callVerificationAPI(text) {
  try {
    // The URL of your Flask API
    const apiUrl = "http://localhost:5002/verify";
    
    console.log("Calling API with text:", text);
    
    // Make the API request
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text: text })
    });
    
    console.log("API response status:", response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("API error response:", errorText);
      throw new Error(`API request failed with status ${response.status}: ${errorText}`);
    }
    
    // Parse the JSON response
    const result = await response.json();
    console.log("API response data:", result);
    
    // Handle empty or invalid response
    if (!result || !result.verdict) {
      console.error("Invalid API response format:", result);
      throw new Error("Invalid response format from API");
    }
    
    return result;
  } catch (error) {
    console.error("Error calling verification API:", error);
    throw error;
  }
}

// Ensure content script is loaded before sending messages
async function ensureContentScriptLoaded(tabId) {
  return new Promise((resolve, reject) => {
    // First try to send a ping message to see if content script is already loaded
    chrome.tabs.sendMessage(tabId, { action: "ping" }, response => {
      if (chrome.runtime.lastError) {
        // Content script is not loaded, inject it
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ["content.js"]
        }).then(() => {
          // Give it a moment to initialize
          setTimeout(resolve, 100);
        }).catch(error => {
          console.error("Error injecting content script:", error);
          reject(error);
        });
      } else {
        // Content script is already loaded
        resolve();
      }
    });
  });
}

// Store search history in Chrome storage
function storeSearchHistory(text, results) {
  chrome.storage.local.get(['searchHistory'], (data) => {
    const history = data.searchHistory || [];
    history.unshift({
      text: text,
      results: results,
      timestamp: new Date().toISOString()
    });
    
    // Keep only the last 20 searches
    if (history.length > 20) {
      history.pop();
    }
    
    chrome.storage.local.set({ searchHistory: history });
  });
}

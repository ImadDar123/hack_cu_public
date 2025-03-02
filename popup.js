document.addEventListener('DOMContentLoaded', function() {
  // Load search history when popup opens
  loadSearchHistory();
  
  // Add event listener for search button
  document.getElementById('search-button').addEventListener('click', function() {
    const searchText = document.getElementById('search-input').value.trim();
    if (searchText.length > 0) {
      // Show feedback that the search is being processed
      const searchButton = document.getElementById('search-button');
      const originalText = searchButton.textContent;
      searchButton.textContent = "Searching...";
      searchButton.disabled = true;
      
      // Send message to background script to find source
      chrome.runtime.sendMessage({
        action: "findSource",
        text: searchText
      });
      
      // Reset button after a short delay (the popup will likely close before this)
      setTimeout(() => {
        searchButton.textContent = originalText;
        searchButton.disabled = false;
      }, 500);
      
      // Close the popup
      window.close();
    }
  });
  
  // Add event listener for Enter key in search input
  document.getElementById('search-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      document.getElementById('search-button').click();
    }
  });
});

// Load and display search history
function loadSearchHistory() {
  chrome.storage.local.get(['searchHistory'], function(data) {
    const historyContainer = document.getElementById('history-container');
    
    if (!data.searchHistory || data.searchHistory.length === 0) {
      historyContainer.innerHTML = '<div class="no-history">No recent searches</div>';
      return;
    }
    
    // Clear the container
    historyContainer.innerHTML = '';
    
    // Add each history item
    data.searchHistory.forEach(function(item) {
      const historyItem = document.createElement('div');
      historyItem.className = 'history-item';
      
      // Format the date
      const date = new Date(item.timestamp);
      const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
      
      historyItem.innerHTML = `
        <div class="history-text">${item.text}</div>
        <div class="history-date">${formattedDate}</div>
      `;
      
      // Add click event to search again
      historyItem.addEventListener('click', function() {
        chrome.runtime.sendMessage({
          action: "findSource",
          text: item.text
        }, function(response) {
          // Optional callback to handle response
          console.log("Search initiated:", response);
        });
        window.close();
      });
      
      historyContainer.appendChild(historyItem);
    });
  });
}

// Create and inject the results overlay
let overlay = null;

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Content script received message:", request.action);
  
  if (request.action === "ping") {
    // Respond to ping to confirm content script is loaded
    sendResponse({status: "ok"});
  } else if (request.action === "showLoading") {
    showLoadingOverlay();
    sendResponse({status: "loading shown"});
  } else if (request.action === "showResults") {
    showResultsOverlay(request.decision, request.summary, request.sources);
    sendResponse({status: "results shown"});
  } else if (request.action === "showError") {
    showErrorOverlay(request.message);
    sendResponse({status: "error shown"});
  }
});

// Inject CSS styles for the overlay
function injectStyles() {
  if (document.getElementById('source-finder-styles')) {
    return;
  }
  
  const style = document.createElement('style');
  style.id = 'source-finder-styles';
  style.textContent = `
    :root {
      --primary: #5e60ce;
      --primary-light: #7678ed;
      --primary-dark: #4a4bb7;
      --secondary: #f5f7fa;
      --text-dark: #2b2d42;
      --text-light: #6c757d;
      --white: #ffffff;
      --true: #4CAF50;
      --false: #F44336;
      --inconclusive: #FF9800;
      --radius: 10px;
      --shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
      --card-shadow: 0 4px 6px rgba(0, 0, 0, 0.08);
    }
    
    #source-finder-overlay {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      color: var(--text-dark);
      background-color: var(--white);
      box-shadow: var(--shadow);
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      border-radius: var(--radius);
      overflow: hidden;
    }
    
    #source-finder-overlay .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 18px;
      background-color: var(--primary);
      color: white;
    }
    
    #source-finder-overlay .header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      letter-spacing: 0.3px;
      display: flex;
      align-items: center;
    }
    
    #source-finder-overlay .close-btn {
      cursor: pointer;
      font-size: 24px;
      line-height: 1;
      opacity: 0.9;
      transition: opacity 0.2s;
    }
    
    #source-finder-overlay .close-btn:hover {
      opacity: 1;
    }
    
    #source-finder-overlay .content {
      padding: 18px;
      overflow-y: auto;
      max-height: calc(90vh - 56px);
      background-color: var(--secondary);
    }
    
    #source-finder-overlay .status-message {
      padding: 18px;
      border-radius: var(--radius);
      margin-bottom: 20px;
      overflow: visible;
      box-shadow: var(--card-shadow);
      background-color: var(--white);
      border-left: 5px solid;
    }
    
    #source-finder-overlay .status-message.true {
      border-left-color: var(--true);
    }
    
    #source-finder-overlay .status-message.false {
      border-left-color: var(--false);
    }
    
    #source-finder-overlay .status-message.inconclusive {
      border-left-color: var(--inconclusive);
    }
    
    #source-finder-overlay .status-title {
      display: flex;
      align-items: center;
      font-weight: 600;
      font-size: 18px;
      margin-bottom: 12px;
      color: var(--text-dark);
    }
    
    #source-finder-overlay .status-icon {
      margin-right: 10px;
      font-size: 20px;
    }
    
    #source-finder-overlay .status-message.true .status-icon {
      color: var(--true);
    }
    
    #source-finder-overlay .status-message.false .status-icon {
      color: var(--false);
    }
    
    #source-finder-overlay .status-message.inconclusive .status-icon {
      color: var(--inconclusive);
    }
    
    #source-finder-overlay .summary-container {
      line-height: 1.6;
      color: var(--text-dark);
      font-size: 15px;
      overflow: visible;
      min-height: 80px;
      padding-left: 30px;
    }
    
    #source-finder-overlay .summary-container p {
      margin: 0 0 12px 0;
    }
    
    #source-finder-overlay .summary-container p:last-child {
      margin-bottom: 0;
    }
    
    #source-finder-overlay .source-reference {
      margin: 8px 0;
      padding-left: 18px;
      position: relative;
      color: var(--text-light);
    }
    
    #source-finder-overlay .source-reference:before {
      content: "•";
      position: absolute;
      left: 0;
      color: var(--primary);
    }
    
    #source-finder-overlay .sources-section {
      background-color: var(--white);
      border-radius: var(--radius);
      padding: 18px;
      box-shadow: var(--card-shadow);
    }
    
    #source-finder-overlay .sources-header {
      display: flex;
      align-items: center;
      margin-bottom: 15px;
      font-weight: 600;
      font-size: 16px;
      color: var(--text-dark);
    }
    
    #source-finder-overlay .sources-container {
      max-height: 250px;
      overflow-y: auto;
      border-radius: 6px;
      background-color: var(--secondary);
    }
    
    #source-finder-overlay .source-item {
      padding: 12px 15px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
      transition: background-color 0.2s;
    }
    
    #source-finder-overlay .source-item:hover {
      background-color: rgba(94, 96, 206, 0.05);
    }
    
    #source-finder-overlay .source-item:last-child {
      border-bottom: none;
    }
    
    #source-finder-overlay .source-title {
      color: var(--primary);
      text-decoration: none;
      font-weight: 500;
      display: block;
      word-break: break-word;
      transition: color 0.2s;
    }
    
    #source-finder-overlay .source-title:hover {
      color: var(--primary-dark);
      text-decoration: underline;
    }
    
    #source-finder-overlay .button {
      background-color: var(--primary);
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: var(--radius);
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s;
    }
    
    #source-finder-overlay .button:hover {
      background-color: var(--primary-dark);
    }
    
    #source-finder-overlay .loader {
      border: 4px solid rgba(0, 0, 0, 0.1);
      border-radius: 50%;
      border-top: 4px solid var(--primary);
      width: 40px;
      height: 40px;
      margin: 0 auto;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    .spinning {
      animation: spin 2s linear infinite;
    }
    
    @keyframes float {
      0% { transform: translateY(0px); }
      50% { transform: translateY(-5px); }
      100% { transform: translateY(0px); }
    }
    
    .floating {
      animation: float 3s ease-in-out infinite;
    }
  `;
  
  document.head.appendChild(style);
}

// Show loading overlay
function showLoadingOverlay() {
  console.log("Showing loading overlay");
  removeOverlay();
  injectStyles();
  
  overlay = document.createElement('div');
  overlay.id = 'source-finder-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '20px';
  overlay.style.right = '20px';
  overlay.style.width = '380px';
  overlay.style.zIndex = '10000';
  
  overlay.innerHTML = `
    <div class="header">
      <h3><i class="fas fa-magnifying-glass-location floating" style="margin-right: 12px;"></i>Source Finder</h3>
      <div class="close-btn" id="source-finder-close">×</div>
    </div>
    <div class="content" style="text-align: center; padding: 40px 16px; background-color: var(--white);">
      <div class="loader spinning"></div>
      <p style="margin-top: 20px; color: var(--text-dark); font-weight: 500;">Finding sources...</p>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Add close button functionality
  document.getElementById('source-finder-close').addEventListener('click', removeOverlay);
}

// Show results overlay
function showResultsOverlay(verdict, summary, sources) {
  console.log("Showing results overlay with data:", { verdict, summary, sources });
  removeOverlay();
  injectStyles();
  
  overlay = document.createElement('div');
  overlay.id = 'source-finder-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '20px';
  overlay.style.right = '20px';
  overlay.style.width = '380px';
  overlay.style.zIndex = '10000';
  
  // Determine the status color and icon based on the verdict
  let statusClass, statusIcon;
  
  if (verdict === "True") {
    statusClass = 'true';
    statusIcon = 'fa-circle-check';
  } else if (verdict === "False") {
    statusClass = 'false';
    statusIcon = 'fa-circle-xmark';
  } else {
    statusClass = 'inconclusive';
    statusIcon = 'fa-circle-question';
  }

  // Clean up the summary format
  const cleanedSummary = cleanSummaryFormat(summary);

  let sourcesHtml = '';
  if (sources && sources.length > 0) {
    sourcesHtml = '<div class="sources-container">';
    
    sources.forEach(source => {
      // Extract a readable title from the URL
      const title = extractTitleFromUrl(source);
      
      sourcesHtml += `
        <div class="source-item">
          <a href="${source}" target="_blank" class="source-title" title="${source}">${title}</a>
        </div>
      `;
    });
    sourcesHtml += '</div>';
  } else {
    sourcesHtml = `
      <div style="color: var(--text-light); font-style: italic; text-align: center; padding: 25px; background-color: var(--secondary); border-radius: 6px;">
        No sources found
      </div>
    `;
  }
  
  overlay.innerHTML = `
    <div class="header">
      <h3><i class="fas fa-magnifying-glass-location floating" style="margin-right: 12px;"></i>Source Finder</h3>
      <div class="close-btn" id="source-finder-close">×</div>
    </div>
    <div class="content">
      <div class="status-message ${statusClass}">
        <div class="status-title">
          <i class="fas ${statusIcon} status-icon"></i>
          ${verdict}
        </div>
        <div class="summary-container">
          ${cleanedSummary}
        </div>
      </div>
      
      <div class="sources-section">
        <div class="sources-header">
          <i class="fas fa-scroll" style="margin-right: 10px; color: var(--primary);"></i>
          Sources
        </div>
        ${sourcesHtml}
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Add close button functionality
  document.getElementById('source-finder-close').addEventListener('click', removeOverlay);
}

// Function to extract a readable title from a URL
function extractTitleFromUrl(url) {
  try {
    // Create a URL object
    const urlObj = new URL(url);
    
    // Get the hostname (domain)
    let domain = urlObj.hostname;
    
    // Remove www. if present
    if (domain.startsWith('www.')) {
      domain = domain.substring(4);
    }
    
    // Format the domain nicely
    const formattedDomain = domain.split('.')[0]
      .replace(/-/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    // Extract article title from path
    let articleTitle = '';
    
    if (urlObj.pathname && urlObj.pathname !== '/' && urlObj.pathname.length > 1) {
      // Get path segments
      const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0);
      
      if (pathSegments.length > 0) {
        // Usually the last segment contains the article title
        let lastSegment = pathSegments[pathSegments.length - 1];
        
        // Remove file extensions
        lastSegment = lastSegment
          .replace(/\.html$/, '')
          .replace(/\.php$/, '')
          .replace(/\.aspx$/, '')
          .replace(/\.htm$/, '');
        
        // Replace dashes, underscores, and plus signs with spaces
        lastSegment = lastSegment
          .replace(/-/g, ' ')
          .replace(/_/g, ' ')
          .replace(/\+/g, ' ');
        
        // Remove date patterns (common in news URLs)
        lastSegment = lastSegment.replace(/\d{4}\/\d{2}\/\d{2}/, '');
        lastSegment = lastSegment.replace(/\d{2}-\d{2}-\d{4}/, '');
        
        // Format the segment as a title if it's not too short or too long
        if (lastSegment.length > 3 && lastSegment.length < 60) {
          articleTitle = lastSegment
            .split(' ')
            .map(word => {
              // Don't capitalize small words like "the", "and", "of", etc. unless they're the first word
              const smallWords = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'of', 'in'];
              return smallWords.includes(word.toLowerCase()) ? word.toLowerCase() : 
                     (word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : '');
            })
            .join(' ');
          
          // Make sure the first word is capitalized
          if (articleTitle.length > 0) {
            articleTitle = articleTitle.charAt(0).toUpperCase() + articleTitle.slice(1);
          }
        }
      }
    }
    
    // For Wikipedia, extract the article title more carefully
    if (domain.includes('wikipedia')) {
      const wikiTitle = urlObj.pathname.split('/').pop().replace(/_/g, ' ');
      if (wikiTitle && wikiTitle.length > 0) {
        return `Wikipedia: ${wikiTitle}`;
      }
    }
    
    // For news sites, try to extract a better title
    if (domain.includes('nytimes') || domain.includes('washingtonpost') || 
        domain.includes('cnn') || domain.includes('bbc') || 
        domain.includes('reuters') || domain.includes('theguardian')) {
      
      // Look for patterns like /year/month/day/title or /news/title
      const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0);
      
      // Skip date segments (usually numbers)
      let titleSegmentIndex = pathSegments.findIndex(segment => isNaN(Number(segment)) && segment.length > 5);
      
      if (titleSegmentIndex !== -1) {
        const titleSegment = pathSegments[titleSegmentIndex]
          .replace(/-/g, ' ')
          .replace(/\d+/g, ''); // Remove any remaining numbers
        
        if (titleSegment.length > 5) {
          // Format as title case
          const formattedTitle = titleSegment
            .split(' ')
            .filter(word => word.length > 0)
            .map((word, index) => {
              const smallWords = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'of', 'in'];
              return (index === 0 || !smallWords.includes(word.toLowerCase())) ? 
                     word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : 
                     word.toLowerCase();
            })
            .join(' ');
          
          return `${formattedDomain}: ${formattedTitle}`;
        }
      }
    }
    
    // If we have an article title, use it with the domain
    if (articleTitle && articleTitle.length > 0) {
      return `${formattedDomain}: ${articleTitle}`;
    }
    
    // Fallback to just the domain if we couldn't extract a good article title
    return formattedDomain;
    
  } catch (e) {
    // If anything goes wrong, return a shortened version of the URL
    console.error("Error extracting title from URL:", e);
    return url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  }
}

// Show error overlay
function showErrorOverlay(message) {
  console.log("Showing error overlay with message:", message);
  removeOverlay();
  injectStyles();
  
  overlay = document.createElement('div');
  overlay.id = 'source-finder-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '20px';
  overlay.style.right = '20px';
  overlay.style.width = '380px';
  overlay.style.zIndex = '10000';
  
  // Format the message text to ensure proper display
  const formattedMessage = message.replace(/\n/g, '<br>');
  
  overlay.innerHTML = `
    <div class="header">
      <h3><i class="fas fa-magnifying-glass-location floating" style="margin-right: 12px;"></i>Source Finder</h3>
      <div class="close-btn" id="source-finder-close">×</div>
    </div>
    <div class="content" style="background-color: var(--secondary);">
      <div class="status-message false">
        <div class="status-title">
          <i class="fas fa-circle-exclamation status-icon"></i>
          Error
        </div>
        <div class="summary-container">
          ${formattedMessage}
        </div>
      </div>
      <div style="text-align: center; margin-top: 20px;">
        <button id="source-finder-retry" class="button">
          <i class="fas fa-redo" style="margin-right: 8px;"></i>Try Again
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Add close button functionality
  document.getElementById('source-finder-close').addEventListener('click', removeOverlay);
  
  // Add retry button functionality
  document.getElementById('source-finder-retry').addEventListener('click', () => {
    removeOverlay();
    // Add any retry logic here if needed
  });
}

// Remove the overlay
function removeOverlay() {
  if (overlay) {
    overlay.remove();
    overlay = null;
  }
}

// Log that content script has loaded
console.log("Source Finder content script loaded");

// Function to clean up the summary format
function cleanSummaryFormat(summary) {
  if (!summary) return '';
  
  // Remove numbered list markers (1., 2., etc.)
  let cleaned = summary.replace(/^\d+\.\s+/gm, '');
  
  // Remove asterisks used for bold formatting
  cleaned = cleaned.replace(/\*\*/g, '');
  
  // Remove "Summary:" and "References:" labels
  cleaned = cleaned.replace(/Summary:\s*/i, '');
  cleaned = cleaned.replace(/References:\s*/i, '');
  
  // Split into paragraphs
  const paragraphs = cleaned.split(/\n+/).filter(p => p.trim().length > 0);
  
  // Format as HTML with proper paragraphs
  if (paragraphs.length > 1) {
    // If we have multiple paragraphs, format them nicely
    return paragraphs.map(p => {
      // Check if this is a list item (starts with - or •)
      if (p.trim().match(/^[-•]/)) {
        return `<div class="source-reference">${p.trim()}</div>`;
      } else {
        return `<p>${p.trim()}</p>`;
      }
    }).join('');
  } else {
    // If it's just one paragraph, return it directly
    return cleaned;
  }
}


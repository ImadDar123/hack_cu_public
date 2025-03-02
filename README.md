# Source Finder Chrome Extension

A Chrome extension that verifies claims by finding reliable sources.

## Setup Instructions

### 1. Set up the Flask API server

1. Install the required Python packages:
   ```
   pip install flask flask-cors openai beautifulsoup4 requests googlesearch-python
   ```

2. Start the Flask server:
   ```
   python search.py
   ```
   The server will run on http://localhost:5000

### 2. Install the Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in the top right)
3. Click "Load unpacked" and select the extension directory
4. The Source Finder extension should now be installed

## Usage

- Highlight text on any webpage
- Right-click and select "Find source for this text"
- Or click the extension icon and enter text manually

## Features

- Verify claims against reliable sources
- See verdict (True, False, or Inconclusive) with supporting evidence
- View sources used for verification
- Search history for previous verifications 
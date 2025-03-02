from bs4 import BeautifulSoup
import requests
import os
import time
import random
import logging
import concurrent.futures
import socket
from urllib.parse import urlparse

# Set up logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Define headers for requests
headers = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/90.0.4430.93 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Referer": "https://www.google.com/",
    "DNT": "1",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1"
}

# Set global socket timeout to fail DNS lookups faster
socket.setdefaulttimeout(2.0)

def is_url_likely_scrapable(url):
    """
    Quick check to see if a URL is likely to be scrapable.
    
    Args:
        url (str): URL to check
        
    Returns:
        bool: True if the URL is likely to be scrapable, False otherwise
    """
    try:
        # Parse the URL
        parsed_url = urlparse(url)
        
        # Skip URLs without a valid scheme or netloc
        if not parsed_url.scheme or not parsed_url.netloc:
            return False
        
        # Skip common problematic domains
        problematic_domains = [
            'facebook.com', 'twitter.com', 'instagram.com', 
            'youtube.com', 'tiktok.com', 'pinterest.com',
            'linkedin.com', 'reddit.com'
        ]
        
        for domain in problematic_domains:
            if domain in parsed_url.netloc:
                return False
        
        # Skip file extensions that are unlikely to contain useful text
        if parsed_url.path:
            file_extensions = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', 
                              '.zip', '.rar', '.mp3', '.mp4', '.avi', '.mov', '.jpg', 
                              '.jpeg', '.png', '.gif', '.svg']
            
            for ext in file_extensions:
                if parsed_url.path.lower().endswith(ext):
                    return False
        
        return True
    except:
        return False

def scrape_url(url, timeout=3):
    """
    Scrape content from a single URL with aggressive timeouts.
    
    Args:
        url (str): URL to scrape
        timeout (int): Timeout in seconds
        
    Returns:
        dict or None: Dictionary with 'url' and 'content' keys, or None if scraping failed
    """
    # Skip if URL is not a string or doesn't start with http
    if not isinstance(url, str) or not (url.startswith('http://') or url.startswith('https://')):
        logger.warning(f"Skipping invalid URL: {url}")
        return None
    
    # Quick check if URL is likely to be scrapable
    if not is_url_likely_scrapable(url):
        logger.warning(f"Skipping likely problematic URL: {url}")
        return None
        
    try:
        logger.info(f"Scraping: {url}")
        
        # Use a session for connection pooling
        session = requests.Session()
        
        # Configure the session
        session.headers.update(headers)
        
        # Make the request with a very short timeout
        # connect=1.0 is for the connection timeout
        # read=2.0 is for the read timeout after connection
        response = session.get(
            url, 
            timeout=(1.0, 2.0),  # (connect timeout, read timeout)
            stream=True,  # Use streaming to start processing before full download
            allow_redirects=True,  # Follow redirects
            verify=False  # Skip SSL verification for speed
        )
        
        # Only process if status code is good
        if response.status_code == 200:
            # Get the content type
            content_type = response.headers.get('Content-Type', '').lower()
            
            # Skip if not HTML
            if 'text/html' not in content_type and 'application/xhtml+xml' not in content_type:
                logger.warning(f"Skipping non-HTML content: {url} (Content-Type: {content_type})")
                response.close()
                return None
            
            # Get the first chunk of content (up to 100KB) to avoid large downloads
            content_chunk = b''
            for chunk in response.iter_content(chunk_size=10240):  # 10KB chunks
                content_chunk += chunk
                if len(content_chunk) >= 100000:  # Stop after 100KB
                    break
            
            # Close the response
            response.close()
            
            # Parse the HTML
            soup = BeautifulSoup(content_chunk, 'html.parser')
            
            # Remove script, style, and other non-content elements
            for element in soup(['script', 'style', 'header', 'footer', 'nav', 'aside']):
                element.decompose()
            
            # Try to find the main content
            main_content = soup.find('main') or soup.find('article') or soup.find('div', class_='content')
            
            if main_content:
                # Get paragraphs from main content
                paragraphs = main_content.find_all('p')
            else:
                # Fallback to all paragraphs
                paragraphs = soup.find_all('p')
            
            # Extract text from paragraphs
            content = " ".join(p.get_text().strip() for p in paragraphs if p.get_text().strip())
            
            # If no paragraphs found, try getting all text
            if not content or len(content) < 100:  # Require at least 100 characters
                content = soup.get_text()
                
                # Clean up the text
                lines = (line.strip() for line in content.splitlines())
                chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
                content = " ".join(chunk for chunk in chunks if chunk)
            
            # Skip if content is too short
            if len(content) < 100:
                logger.warning(f"Not enough content from {url} - only {len(content)} chars")
                return None
            
            # Limit content to 10,000 characters
            content = content[:10000]
            
            logger.info(f"Successfully scraped {url} - Content length: {len(content)} chars")
            return {
                'url': url,
                'content': content
            }
        else:
            logger.warning(f"Failed to fetch {url}: Status code {response.status_code}")
            response.close()
            return None
            
    except requests.exceptions.ConnectTimeout:
        logger.warning(f"Connection timeout for {url} - skipping")
    except requests.exceptions.ReadTimeout:
        logger.warning(f"Read timeout for {url} - skipping")
    except requests.exceptions.ConnectionError:
        logger.warning(f"Connection error for {url} - skipping")
    except requests.exceptions.TooManyRedirects:
        logger.warning(f"Too many redirects for {url} - skipping")
    except requests.exceptions.RequestException as e:
        logger.warning(f"Request exception for {url}: {str(e)}")
    except Exception as e:
        logger.error(f"Error scraping {url}: {str(e)}")
    
    return None

def scrape_sources(sources, max_workers=10, max_sources=8):
    """
    Scrape content from a list of URLs using parallel processing.
    
    Args:
        sources (list): List of URLs to scrape
        max_workers (int): Maximum number of parallel workers
        max_sources (int): Maximum number of sources to return
        
    Returns:
        list: List of dictionaries with 'url' and 'content' keys
    """
    # Filter out obviously invalid URLs first
    valid_sources = [url for url in sources if isinstance(url, str) and 
                    (url.startswith('http://') or url.startswith('https://')) and
                    is_url_likely_scrapable(url)]
    
    if not valid_sources:
        logger.warning("No valid sources to scrape")
        return []
    
    scraped_content = []
    
    # Use ThreadPoolExecutor for parallel scraping
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all scraping tasks
        future_to_url = {executor.submit(scrape_url, url): url for url in valid_sources}
        
        # Process results as they complete
        for future in concurrent.futures.as_completed(future_to_url):
            url = future_to_url[future]
            try:
                result = future.result()
                if result:
                    scraped_content.append(result)
                    logger.info(f"Added content from {url} - Total sources: {len(scraped_content)}/{max_sources}")
                    
                    # If we have enough sources, cancel remaining futures
                    if len(scraped_content) >= max_sources:
                        for f in future_to_url:
                            if not f.done():
                                f.cancel()
                        break
            except Exception as e:
                logger.error(f"Error processing result for {url}: {str(e)}")
    
    logger.info(f"Scraping complete. Successfully scraped {len(scraped_content)} sources.")
    return scraped_content


from flask import Flask, request, jsonify
from prompt import make_prompt
from google_search import get_sources
from scrape import scrape_sources
from verification import verify_claim
from openai import OpenAI
import json

# Test text
text = "the 5 year survival rate for cancer is 75%"

# Prompts
make_prompt_prompt = "You are a fact checking algorithm. Take the given text and create a helpful google search that can be used to help research the claim. Include no other information, only the search"
verification_prompt = "You are a verification algorithm. Your job is to analyze the claim and the provided sources to determine if the claim is supported or contradicted by the sources. Summarize the most relevant information from the sources that supports or contradicts the claim. Provide your verdict (True, False, or Inconclusive) followed by a brief summary of the evidence. Be concise."

# Create OpenAI client
organizationID = 'org-FybWVqGLBkw8CvVotBhNd5ks'
projectId = 'proj_lekqqu5XfNaN4TSSpvs6JBqR'
api_key = 'Enter here'

client = OpenAI(
    organization=organizationID,
    project=projectId,
    api_key=api_key
)

try:
    # Step 1: Generate search prompt
    print("Generating search prompt...")
    prompt = make_prompt(text, make_prompt_prompt)
    print(f"Search prompt: {prompt}")

    # Step 2: Get sources
    print("\nSearching for sources...")
    sources = get_sources(prompt, num_results=20)
    print(f"Found {len(sources)} sources:")
    for i, source in enumerate(sources):
        print(f"  {i+1}. {source}")

    # Step 3: Scrape content
    print("\nScraping content from sources...")
    scraped_content = scrape_sources(sources)
    print(f"Successfully scraped {len(scraped_content)} sources")

    # Step 4: Verify claim
    if scraped_content:
        print("\nVerifying claim...")
        verification_result = verify_claim(text, scraped_content, verification_prompt)
        
        # Print the structured result
        print("\nVerification result:")
        print(f"Verdict: {verification_result['verdict']}")
        print(f"\nSummary: {verification_result['summary']}")
        
        print("\nSources used:")
        for source in verification_result['sources']:
            print(f"  {source['index']}. {source['url']}")
            
        # Optional: Print the full JSON for debugging
        print("\nFull JSON result:")
        print(json.dumps(verification_result, indent=2))
    else:
        print("\nNo content was scraped from sources. Cannot verify claim.")

except Exception as e:
    print(f"\nError during execution: {str(e)}")

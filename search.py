from flask import Flask, request, jsonify
from flask_cors import CORS
from prompt import make_prompt
from google_search import get_sources
from scrape import scrape_sources
from verification import verify_claim
from openai import OpenAI
import traceback

# Initialize Flask app
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # Allow all origins for all routes

# OpenAI client configuration
organizationID = 'org-FybWVqGLBkw8CvVotBhNd5ks'
projectId = 'proj_lekqqu5XfNaN4TSSpvs6JBqR'
api_key = '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'
model = "gpt-4o-mini"

client = OpenAI(
    organization=organizationID,
    project=projectId,
    api_key=api_key
)

# Prompts
make_prompt_prompt = "You are a fact checking algorithm. Take the given text and create a helpful google search that can be used to help research the claim. Include no other information, only the search"
verification_prompt = "You are a verification algorithm. Your job is to analyze the claim and the provided sources to determine if the claim is supported or contradicted by the sources. Summarize the most relevant information from the sources that supports or contradicts the claim. Provide your verdict (True, False, or Inconclusive) followed by a brief summary of the evidence. Be concise."

# Fix the route conflict - remove the duplicate route
@app.route("/", methods=["GET"])
def index():
    return jsonify({"status": "ok", "message": "Source Finder API is running"}), 200

@app.route("/verify", methods=["POST"])
def verify_text():
    try:
        # Get the text from the request
        data = request.json
        print("Received data:", data)  # Debug print
        
        if not data:
            print("No JSON data received")
            return jsonify({"error": "No JSON data received"}), 400
            
        if 'text' not in data:
            print("No text field in JSON data")
            return jsonify({"error": "No text provided"}), 400
        
        text = data['text']
        print(f"Received verification request for: {text}")
        
        # Step 1: Generate search prompt
        print("Generating search prompt...")
        prompt = make_prompt(text, make_prompt_prompt)
        print(f"Search prompt: {prompt}")
        
        # Step 2: Get sources
        print("Searching for sources...")
        sources = get_sources(prompt, num_results=10)
        print(f"Found {len(sources)} sources")
        
        # Step 3: Scrape content
        print("Scraping content from sources...")
        scraped_content = scrape_sources(sources)
        print(f"Successfully scraped {len(scraped_content)} sources")
        
        # Step 4: Verify claim
        if scraped_content:
            print("Verifying claim...")
            verification_result = verify_claim(text, scraped_content, verification_prompt)
            print("Verification complete")
            
            # Return the result
            return jsonify(verification_result)
        else:
            return jsonify({
                "verdict": "Inconclusive",
                "summary": "No content could be scraped from sources to verify this claim.",
                "sources": []
            })
            
    except Exception as e:
        print(f"Error during verification: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# Add a test endpoint
@app.route("/test", methods=["GET"])
def test_endpoint():
    return jsonify({
        "status": "ok",
        "message": "Test endpoint is working",
        "endpoints": {
            "/": "Health check",
            "/verify": "Verify text (POST)",
            "/test": "This test endpoint"
        }
    })

if __name__ == "__main__":
    # Enable debug mode and specify host to allow external connections
    app.run(debug=True, host='0.0.0.0', port=5002)


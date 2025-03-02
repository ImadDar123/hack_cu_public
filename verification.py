from openai import OpenAI
import json
import re

organizationID = 'org-FybWVqGLBkw8CvVotBhNd5ks'
projectId = 'proj_lekqqu5XfNaN4TSSpvs6JBqR'
api_key = 'Enter here'
model = "gpt-4o-mini"

client = OpenAI(
    organization=organizationID,
    project=projectId,
    api_key=api_key
)

def extract_verdict(text):
    """
    Extract the verdict (True, False, Inconclusive) from the verification result.
    
    Args:
        text (str): The verification result text
        
    Returns:
        str: The verdict (True, False, or Inconclusive)
    """
    # Look for verdict at the beginning of the text
    first_line = text.split('\n')[0] if '\n' in text else text
    first_line = first_line.lower()
    
    if 'true' in first_line:
        return "True"
    elif 'false' in first_line:
        return "False"
    elif 'inconclusive' in first_line:
        return "Inconclusive"
    
    # If not found in the first line, search the entire text
    text_lower = text.lower()
    if 'verdict: true' in text_lower or 'assessment: true' in text_lower:
        return "True"
    elif 'verdict: false' in text_lower or 'assessment: false' in text_lower:
        return "False"
    elif 'verdict: inconclusive' in text_lower or 'assessment: inconclusive' in text_lower:
        return "Inconclusive"
    
    # Default to Inconclusive if no clear verdict
    return "Inconclusive"

def verify_claim(claim, scraped_content, prompt_engineering, temp=0.7, max_tokens=500):
    """
    Verifies a claim against scraped content using OpenAI.
    
    Args:
        claim (str): The claim to verify
        scraped_content (list): List of dictionaries with 'url' and 'content' keys
        prompt_engineering (str): The system prompt for the OpenAI model
        temp (float): Temperature for the model
        max_tokens (int): Maximum tokens for the response
        
    Returns:
        dict: Verification result with verdict, summary, and sources
    """
    # Prepare the content for analysis
    support_text = ""
    sources = []
    
    for i, source in enumerate(scraped_content):
        # Limit content length to avoid token limits
        content_preview = source['content'][:1000] + "..." if len(source['content']) > 1000 else source['content']
        support_text += f"\nSOURCE {i+1} (URL: {source['url']}):\n{content_preview}\n"
        
        # Add source to the sources list
        sources.append({
            "url": source['url'],
            "index": i+1
        })
    
    # Combine claim and support into a single message
    combined_text = f"CLAIM: {claim}\n\nSOURCES:\n{support_text}"
    
    try:
        # First, try to get a structured response using function calling
        structured_prompt = """
        You are a verification algorithm. Your job is to analyze the claim and the provided sources to determine if the claim is supported or contradicted by the sources.
        
        You must return a structured response with:
        1. A verdict: "True", "False", or "Inconclusive"
        2. A summary of the most relevant information from the sources
        3. References to which sources support your conclusion
        
        Be concise and objective in your assessment.
        """
        
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": structured_prompt},
                {"role": "user", "content": combined_text}
            ],
            temperature=temp,
            max_tokens=max_tokens
        )
        
        result_text = response.choices[0].message.content.strip()
        
        # Extract the verdict from the response
        verdict = extract_verdict(result_text)
        
        # Extract the summary (everything after the verdict line)
        summary = result_text
        if '\n' in result_text:
            first_line_end = result_text.find('\n')
            if 'true' in result_text[:first_line_end].lower() or 'false' in result_text[:first_line_end].lower() or 'inconclusive' in result_text[:first_line_end].lower():
                summary = result_text[first_line_end:].strip()
        
        # Create the structured response
        result = {
            "verdict": verdict,
            "summary": summary,
            "sources": sources
        }
        
        return result
        
    except Exception as e:
        print(f"Error in verification: {str(e)}")
        return {
            "verdict": "Error",
            "summary": f"Error during verification: {str(e)}",
            "sources": sources
        }

# Example prompt for reference
prompt_engineering = "You are a verification algorithm that will take in two things after this. The first will be a claim from the user. Your job is to use the second peice of information give, the support and decide wether or not this claim supports or contridects the claim. Then summarize the part that most shows the contraction or support for the claim. Only give a single answer, True or False and the summarized source. Be as concise as possible"
# support = "The united states of america gave ukraine 200 billion dollars in aid. This occured during the peiord of time between 2022 and 2025."
# print(verify_claim("we gave ukraine 500bn in aid", support, client, prompt_engineering))
#
# def pick_best_sources(claim, sources, prompt_engineering, temp=0.7, max_tokens=150):
#     answers = []
#     for i in range(len(sources)):
#         answers.append(verify_claim(claim, sources[i], client, prompt_engineering, temp, max_tokens))
#     source = ""
#     for i in range(len(answers)):
#         source = source + "Claim " + str(i) + " " + answers[i]
#     response = client.chat.completions.create(
#         model=model,
#         messages=[{"role": "system", "content": "You need to take the following set of sources and compare them to each other and find the one that is the strongest. Return this exactly as given. Do not explain your reasoning. Do not provide the claim number. Simply state the claim as it appears after Claim #."},
#                   {"role": "user", "content": source}],
#         temperature=temp,
#         max_tokens=max_tokens
#     )
#     return response.choices[0].message.content.strip()
#
# # print(pick_best_sources("your moms a hoe", ["true", "there is a high probalbity", "false"], prompt_engineering))

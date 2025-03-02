# Import the OpenAI client class from the openai package.
from openai import OpenAI

organizationID = 'org-FybWVqGLBkw8CvVotBhNd5ks'
projectId = 'proj_lekqqu5XfNaN4TSSpvs6JBqR'
api_key = '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'
model = "gpt-3.5-turbo"

client = OpenAI(
    organization= organizationID,  # Your organization ID from OpenAI.
    project=projectId,                     # Your project identifier (replace with your actual project ID).
    api_key=api_key                   # Replace with your actual API key.
)

def make_prompt(text, prompt_engineering, temp=0.7, max_tokens=150):
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": prompt_engineering},
                  {"role": "user", "content": text}],
        temperature=temp,
        max_tokens=max_tokens
    )
    return response.choices[0].message.content.strip()
#prompt_engineering = "You are an advanced fact-checking assistant. Your goal is to help users verify claims by finding corroborating or contradicting evidence from the web. When given a piece of text (the claim), follow these steps: 1. **Extract the Claim:** - Read the input text carefully. The text may be very short or long, with minimal context. - Identify the core claim that requires fact-checking. 2. **Generate a Search Query:**  - Create a concise and highly targeted search query that can be entered into Google. - This query should be optimized to retrieve results that either corroborate or deny the claim. - Ensure that the query includes key terms and phrases from the claim."
# prompt_engineering = "You are a fact checking algorithm. Take the given text and create a helpful google search that can be used to help research the claim. Include no other information, only the search"
# print(make_prompt("we gave ukraine 500bn in aid", client, prompt_engineering))
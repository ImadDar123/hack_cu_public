from googlesearch import search
from openai import OpenAI
import re
import json

organizationID = 'org-FybWVqGLBkw8CvVotBhNd5ks'
projectId = 'proj_lekqqu5XfNaN4TSSpvs6JBqR'
api_key = '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'
model = "gpt-4o-mini"

client = OpenAI(
    organization=organizationID,
    project=projectId,
    api_key=api_key
)

def get_sources(query, num_results=10):
    """
    Get a list of URLs from Google search results.

    Args:
        query (str): The search query
        num_results (int): Number of results to return

    Returns:
        list: List of URLs
    """
    all_urls = []

    # Try to get a Wikipedia result
    wiki_results = list(search(f"{query} site:wikipedia.org", num_results=1))
    all_urls.extend(wiki_results)

    # Try to get news results
    news_results = list(search(f"{query} site:news", num_results=2))
    all_urls.extend(news_results)

    # Try to get some academic or medical results for health claims
    if "cancer" in query.lower() or "health" in query.lower() or "medical" in query.lower() or "vaccine" in query.lower():
        medical_results = list(search(f"{query} site:nih.gov OR site:cancer.gov OR site:mayoclinic.org", num_results=2))
        all_urls.extend(medical_results)

    # Get general results to fill up to the requested number
    remaining = max(0, num_results - len(all_urls))
    if remaining > 0:
        general_results = list(search(query, num_results=remaining))
        all_urls.extend(general_results)

    # Filter out invalid URLs and duplicates
    valid_urls = []
    seen_urls = set()

    for url in all_urls:
        # Skip if it's not a string or doesn't start with http
        if not isinstance(url, str) or not (url.startswith('http://') or url.startswith('https://')):
            continue

        # Skip duplicates
        if url in seen_urls:
            continue

        valid_urls.append(url)
        seen_urls.add(url)

    return get_most_reputable(valid_urls)
def get_most_reputable(list_urls, num_results=20, temp=0.5, max_tokens=500):
    urls = ""
    for i in range(len(list_urls)):
        urls = urls + f"URL Number {i}: {list_urls[i]}"
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": f"You are a system designed to look through a list of urls and return the one that is the most reputable source. In this case you will look through {len(urls)} urls and return {num_results} results. You must only return the urls. Under no circumstances should you return anything but the urls."},
            {"role": "user", "content": f"Here is the list of URLs to search through {urls}"}
        ],
        temperature=temp,
        max_tokens=max_tokens
    )
    chat_responce = response.choices[0].message.content.strip()
    most_reputable = re.findall(r'https?://\S+', chat_responce)
    return most_reputable
print(get_sources("what color is a blue whale"))
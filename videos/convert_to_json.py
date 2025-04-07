import requests
import json
import re
from googletrans import Translator

URL = "https://www.youtube.com/@holyarmyfellowship4726/videos"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"
}

# Initialize translator
translator = Translator()

def fetch_page(url):
    print(f"Fetching page: {url}")
    response = requests.get(url, headers=HEADERS)
    if response.status_code != 200:
        print(f"Failed to fetch page: {response.status_code}")
        return None
    return response.text

def fetch_continuation(continuation_token):
    continuation_url = "https://www.youtube.com/youtubei/v1/browse"
    payload = {
        "continuation": continuation_token,
        "context": {"client": {"clientName": "WEB", "clientVersion": "2.20250304"}}
    }
    print(f"Fetching continuation batch...")
    response = requests.post(continuation_url, headers=HEADERS, json=payload)
    if response.status_code != 200:
        print(f"Failed to fetch continuation: {response.status_code}")
        return None
    return response.json()

def decode_and_translate(raw_title):
    print(f"Raw input from JSON: {raw_title}")
    try:
        # Decode Unicode escape sequences
        decoded_title = raw_title.encode().decode("unicode_escape") if "\\u" in raw_title else raw_title
        print(f"After first decode: {decoded_title}")
        
        # Ensure fully decoded
        decoded_title = decoded_title.encode().decode("utf-8") if "\\u" in decoded_title else decoded_title
        print(f"Final decoded title: {decoded_title}")
        
        # Translate to English
        translated = translator.translate(decoded_title, src="te", dest="en").text
    except Exception as e:
        print(f"Processing failed for '{raw_title}': {e}")
        decoded_title = raw_title  # Fallback
        translated = raw_title  # Fallback

    return {"original": decoded_title, "translated": translated}

def scrape_all_videos():
    # Fetch initial page
    html = fetch_page(URL)
    if not html:
        return []

    print("Searching for ytInitialData...")
    script_text = re.search(r"var ytInitialData = ({.*?});", html, re.DOTALL)
    if not script_text:
        print("Could not find ytInitialData.")
        return []

    print("Parsing initial JSON...")
    try:
        data = json.loads(script_text.group(1))
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON: {e}")
        return []
    
    try:
        video_grid = data["contents"]["twoColumnBrowseResultsRenderer"]["tabs"][1]["tabRenderer"]["content"]["richGridRenderer"]["contents"]
    except KeyError as e:
        print(f"Failed to find video data: {e}")
        return []

    videos = {}
    continuation_token = None

    # Process initial batch
    for item in video_grid:
        if "richItemRenderer" in item:
            video = item["richItemRenderer"]["content"]["videoRenderer"]
            video_id = video["videoId"]
            raw_title = video["title"]["runs"][0]["text"]
            title_data = decode_and_translate(raw_title)
            videos[video_id] = {
                "title_original": title_data["original"],
                "title_translated": title_data["translated"],
                "url": f"https://www.youtube.com/watch?v={video_id}"
            }
        elif "continuationItemRenderer" in item:
            continuation_token = item["continuationItemRenderer"]["continuationEndpoint"]["continuationCommand"]["token"]

    print(f"Found {len(videos)} unique videos in initial batch.")

    # Fetch additional batches
    while continuation_token:
        continuation_data = fetch_continuation(continuation_token)
        if not continuation_data:
            break
        
        try:
            next_items = continuation_data["onResponseReceivedActions"][0]["appendContinuationItemsAction"]["continuationItems"]
        except KeyError as e:
            print(f"Failed to parse continuation data: {e}")
            break

        continuation_token = None
        for item in next_items:
            if "richItemRenderer" in item:
                video = item["richItemRenderer"]["content"]["videoRenderer"]
                video_id = video["videoId"]
                raw_title = video["title"]["runs"][0]["text"]
                title_data = decode_and_translate(raw_title)
                videos[video_id] = {
                    "title_original": title_data["original"],
                    "title_translated": title_data["translated"],
                    "url": f"https://www.youtube.com/watch?v={video_id}"
                }
            elif "continuationItemRenderer" in item:
                continuation_token = item["continuationItemRenderer"]["continuationEndpoint"]["continuationCommand"]["token"]

        print(f"Total unique videos so far: {len(videos)}")
        if not continuation_token:
            print("No more continuation tokens found.")
            break

    return list(videos.values())

def save_to_file(videos, filename="youtube_videos1.json"):
    print(f"Saving {len(videos)} videos...")
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(videos, f, indent=4, ensure_ascii=False)
    print(f"Saved {len(videos)} unique videos to {filename}")

if __name__ == "__main__":
    video_list = scrape_all_videos()
    if video_list:
        save_to_file(video_list)
    else:
        print("No videos found or scraping failed.")
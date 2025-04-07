import json
import re
from collections import defaultdict
from datetime import datetime

# Load JSON data (replace 'all_videos.json' with your actual JSON file)
with open("youtube_videos.json", "r", encoding="utf-8") as file:
    videos = json.load(file)

# HTML Template for each video card
video_template = """
<div class="video-card" data-category="{category}">
    <div class="video-thumbnail">
        <iframe
            src="{video_url}"
            title="{title_original}"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
        ></iframe>
    </div>
    <div class="video-info">
        <h3>{title_cleaned}</h3>
        {date_paragraph}
        <p class="singer">{singer_name}</p>
    </div>
</div>
"""

# Function to determine category
def determine_category(title_original, title_translated):
    lower_title = (title_original + " " + title_translated).lower()

    # Check for "rani" first - highest priority
    if "rani" in lower_title:
        return "rani"
    # Check for "song" next
    elif "song" in lower_title:
        return "songs"
    # Then check for "abraham" (will only trigger if "rani" isn't present)
    elif "abraham" in lower_title:
        return "abraham"
    # Existing categories
    elif "retreat" in lower_title:
        return "retreats"
    elif "second" in lower_title:
        return "special"
    elif "sunday" in lower_title:
        return "sunday"
    return "all-songs Sis. Smiley"

# Function to convert date into "12th MAY 2024" format
def format_date(date_str):
    try:
        possible_formats = [
            "%d/%m/%Y", "%d-%m-%Y", "%d %b %Y", "%B %d, %Y", "%d %B %Y"
        ]
        
        for fmt in possible_formats:
            try:
                date_obj = datetime.strptime(date_str, fmt)
                break
            except ValueError:
                continue
        else:
            return None, None  # If no format matches, return None, None
        
        # Convert day into ordinal form (1st, 2nd, 3rd, etc.)
        day = int(date_obj.strftime("%d"))
        suffix = "th" if 11 <= day <= 13 else {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")
        formatted_date = f"{day}{suffix} {date_obj.strftime('%B').upper()} {date_obj.year}"
        
        return f'<p class="message-date">{formatted_date}</p>', formatted_date
    
    except Exception as e:
        print(f"Error parsing date: {date_str} - {e}")
        return None, None

# Function to extract, format, and remove the date from the title
def extract_and_clean_title(title_original, title_translated):
    lower_title = title_original + " " + title_translated

    # Regex patterns to match different date formats
    date_patterns = [
        r"\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b",  # 08-02-2025 or 08/02/2025
        r"\b(\w+)\s(\d{1,2}),\s(\d{4})\b",         # February 08, 2025
        r"\b(\d{1,2})\s(\w+)\s(\d{4})\b"           # 08 Feb 2025
    ]
    
    for pattern in date_patterns:
        match = re.search(pattern, lower_title, re.IGNORECASE)
        if match:
            date_str = match.group(0)  # Extract the date part
            formatted_date, display_date = format_date(date_str)
            if formatted_date:
                # Remove the date from the title
                title_cleaned = re.sub(re.escape(date_str), "", title_original).strip()
                return title_cleaned, formatted_date
    
    return title_original, ""  # If no date found, return original title and empty date

# Organize videos into categories
categorized_videos = defaultdict(list)

for video in videos:
    category = determine_category(video["title_original"], video["title_translated"])
    
    # Extract and clean title while getting the formatted date
    title_cleaned, date_paragraph = extract_and_clean_title(video["title_original"], video["title_translated"])
    
    # Add date only for "sunday", "special", and "retreats" categories
    if category not in ["sunday", "special", "retreats"]:
        date_paragraph = ""  # No date for other categories
    
    # Assign singer/speaker name based on category
    singer_name = "Speaker: Bro. M. Abraham" if category == "abraham" else "Sis. Smiley Shebna"

    video_html = video_template.format(
        video_url=video["url"],
        title_original=video["title_original"],
        title_cleaned=title_cleaned,
        category=category,
        date_paragraph=date_paragraph,
        singer_name=singer_name
    )
    
    categorized_videos[category].append(video_html)

# Generate HTML output with sections for each category
html_output = ""

for category, videos in categorized_videos.items():
    html_output += f"\n<!-- {category} -->\n"
    html_output += "\n".join(videos)

# Save the generated HTML
output_file = "categorized_videos.html"
with open(output_file, "w", encoding="utf-8") as file:
    file.write(html_output)

print(f"✅ HTML file generated successfully: {output_file}")

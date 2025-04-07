from docx import Document
import html

def convert_docx_to_html(docx_path, output_html_path):
    # Load the Word document
    doc = Document(docx_path)
    
    # HTML template start
    html_content = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Document</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body>
"""
    
    current_chapter = None
    paragraphs = []
    
    # Process each paragraph in the document
    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:  # Skip empty paragraphs
            continue
            
        # Check if paragraph is bold (assuming chapter titles are fully bold)
        is_bold = all(run.bold for run in para.runs if run.text.strip())
        
        if is_bold:
            # If we have a previous chapter with paragraphs, add it to HTML
            if current_chapter and paragraphs:
                html_content += create_chapter_html(current_chapter, paragraphs)
                paragraphs = []
            current_chapter = text
        elif current_chapter:  # Regular paragraph under a chapter
            paragraphs.append(text)
    
    # Add the last chapter if exists
    if current_chapter and paragraphs:
        html_content += create_chapter_html(current_chapter, paragraphs)
    
    # HTML template end
    html_content += """
</body>
</html>
"""
    
    # Write to output file
    with open(output_html_path, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print(f"HTML file has been created: {output_html_path}")

def create_chapter_html(chapter_title, paragraphs):
    # Escape special HTML characters
    chapter_title = html.escape(chapter_title)
    escaped_paragraphs = [html.escape(p) for p in paragraphs]
    
    # Create chapter index for audio file naming (simple increment based on title)
    chapter_index = ''.join(filter(str.isdigit, chapter_title)) or "1"
    
    # Create paragraph blocks with audio containers
    paragraph_blocks = []
    for idx, para in enumerate(escaped_paragraphs, 1):
        audio_file = f"../src/audios/chapter{chapter_index}_para{idx}.wav"
        paragraph_block = f"""                  <p>{para}</p>
                  
                  <div class="audio-container">
                    <div class="audio-player">
                      <button class="audio-play-btn">
                        <i class="fas fa-play"></i>
                      </button>
                      <div class="audio-progress">
                        <div class="audio-progress-bar"></div>
                      </div>
                      <div class="audio-time">0:40</div>
                      <audio src="{audio_file}"></audio>
                    </div>
                  </div>
"""
        paragraph_blocks.append(paragraph_block)
    
    # Join all paragraph blocks
    paragraphs_html = "\n".join(paragraph_blocks)
    
    # Return chapter HTML structure
    return f"""          <div class="chapter">
            <div class="chapter-header">
              <h2><i class="fas fa-ghost"></i> {chapter_title}</h2>
              <i class="fas fa-chevron-down"></i>
            </div>
            <div class="chapter-content">
              <div class="chapter-inner">
                <div class="chapter-text">
{paragraphs_html}
                </div>
              </div>
            </div>
          </div>
"""

# Example usage
if __name__ == "__main__":
    input_docx = r"C:\Users\itzgo\Desktop\HAF\Docs\Eng_testimony.docx"  # Replace with your Word document path
    output_html = "output.html"  # Output HTML file name
    convert_docx_to_html(input_docx, output_html)
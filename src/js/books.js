// Book content will be stored here
const bookContents = {
  'power-of-prayer': {
    title: 'The Power of Prayer',
    chapters: [
      {
        title: 'Chapter 1: Understanding Prayer',
        content: '' // Content will be added later with <p> tags
        
      },
      {
        title: 'Chapter 2: The Practice of Prayer',
        content: '' // Content will be added later with <p> tags
      }
    ]
  },
  'walking-in-faith': {
    title: 'Walking in Faith',
    chapters: [
      {
        title: 'Chapter 1: The Journey Begins',
        content: '' // Content will be added later with <p> tags
      },
      {
        title: 'Chapter 2: Growing in Faith',
        content: '' // Content will be added later with <p> tags
      }
    ]
  },
  'daily-devotionals': {
    title: 'Daily Devotionals',
    chapters: [
      {
        title: 'January Devotionals',
        content: '' // Content will be added later with <p> tags
      },
      {
        title: 'February Devotionals',
        content: '' // Content will be added later with <p> tags
      }
    ]
  }
};

let currentBook = '';
let currentChapter = 0;

function openReader(bookId) {
  currentBook = bookId;
  currentChapter = 0;
  
  const modal = document.getElementById('readerModal');
  const title = document.getElementById('readerTitle');
  const content = document.getElementById('readerContent');
  const chapterSelect = document.getElementById('chapterSelect');
  
  // Set the title
  title.textContent = bookContents[bookId].title;
  
  // Clear and populate chapter select
  chapterSelect.innerHTML = '';
  bookContents[bookId].chapters.forEach((chapter, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = chapter.title;
    chapterSelect.appendChild(option);
  });
  
  // Load first chapter
  content.innerHTML = bookContents[bookId].chapters[0].content;
  
  // Show modal
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');
  
  // Focus handling
  const focusableElements = modal.querySelectorAll('button, select, [href], input, [tabindex]:not([tabindex="-1"])');
  const firstFocusableElement = focusableElements[0];
  firstFocusableElement.focus();
}

function closeReader() {
  const modal = document.getElementById('readerModal');
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
}

function changeChapter() {
  const chapterSelect = document.getElementById('chapterSelect');
  const content = document.getElementById('readerContent');
  currentChapter = parseInt(chapterSelect.value);
  content.innerHTML = bookContents[currentBook].chapters[currentChapter].content;
}

function navigateChapter(direction) {
  const chapterSelect = document.getElementById('chapterSelect');
  const newChapter = currentChapter + direction;
  
  if (newChapter >= 0 && newChapter < bookContents[currentBook].chapters.length) {
    currentChapter = newChapter;
    chapterSelect.value = currentChapter;
    changeChapter();
  }
}

// Close modal when clicking outside
window.onclick = function(event) {
  const modal = document.getElementById('readerModal');
  if (event.target === modal) {
    closeReader();
  }
}

// Keyboard navigation
document.addEventListener('keydown', function(e) {
  const modal = document.getElementById('readerModal');
  if (modal.style.display === 'flex') {
    if (e.key === 'Escape') {
      closeReader();
    } else if (e.key === 'ArrowRight') {
      navigateChapter(1);
    } else if (e.key === 'ArrowLeft') {
      navigateChapter(-1);
    }
  }
});
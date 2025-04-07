import { db } from './firebase-config.js';
import { doc, getDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

let selectedSize = "8x12";
let unsubscribe = null;
let currentLanguage = 'en_us';
let isCustomText = true;

// Bible API Configuration
const API_KEY = '125ccc7edac23d4a6169855aebcd3f5b';
const BIBLE_API_URL = 'https://api.scripture.api.bible/v1';
const BIBLE_IDS = {
  en_us: '9879dbb7cfe39e4d-01', // KJV
  tel: 'b17e246951402e50-01'    // Telugu Bible (IRV)
};

document.addEventListener('DOMContentLoaded', () => {
  if (!window.auth.checkAuth()) return;
  
  const userId = sessionStorage.getItem('loggedInUserId');
  if (userId) {
    subscribeToCartUpdates(userId);
  }
  
  setupTextInput();
  setupSizeSelector();
  setupNavigation();
  setupTextTypeToggle();
  setupBibleVerseSelectors();
  setupLanguageToggle();
  verifyBibleAvailability();
  updateDisclaimerVisibility(currentLanguage);
});

// Function to update disclaimer visibility
function updateDisclaimerVisibility(language) {
  const englishDisclaimer = document.getElementById('english-disclaimer');
  const teluguDisclaimer = document.getElementById('telugu-disclaimer');
  
  if (isCustomText) {
    englishDisclaimer.classList.remove('active');
    teluguDisclaimer.classList.remove('active');
    return;
  }

  if (language === 'en_us') {
    englishDisclaimer.classList.add('active');
    teluguDisclaimer.classList.remove('active');
  } else {
    englishDisclaimer.classList.remove('active');
    teluguDisclaimer.classList.add('active');
  }
}

// Verify Bible availability
async function verifyBibleAvailability() {
  try {
    const response = await fetch(`${BIBLE_API_URL}/bibles`, {
      headers: {
        'api-key': API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch Bible versions');
    }

    const data = await response.json();
    const availableBibles = data.data;

    // Find Telugu Bible
    const teluguBible = availableBibles.find(bible => 
      bible.language.id === 'tel' && bible.language.name === 'Telugu'
    );

    if (teluguBible) {
      BIBLE_IDS.tel = teluguBible.id;
      console.log('Found Telugu Bible:', teluguBible.id);
    } else {
      console.error('No Telugu Bible found');
      // Disable Telugu option if no Bible is available
      const teluguBtn = document.querySelector('.language-btn[data-lang="tel"]');
      if (teluguBtn) {
        teluguBtn.disabled = true;
        teluguBtn.title = 'Telugu Bible currently unavailable';
      }
    }
  } catch (error) {
    console.error('Error verifying Bible availability:', error);
  }
}

function setupTextTypeToggle() {
  const typeButtons = document.querySelectorAll('.type-btn');
  const customTextSection = document.getElementById('customTextSection');
  const bibleVerseSection = document.getElementById('bibleVerseSection');

  typeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      typeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      isCustomText = btn.dataset.type === 'custom';
      
      if (isCustomText) {
        customTextSection.style.display = 'block';
        bibleVerseSection.style.display = 'none';
        updateDisclaimerVisibility(currentLanguage); // Hide disclaimers for custom text
      } else {
        customTextSection.style.display = 'none';
        bibleVerseSection.style.display = 'block';
        updateDisclaimerVisibility(currentLanguage); // Show appropriate disclaimer
      }

      updateAddToCartButton();
    });
  });
}

async function fetchFromAPI(endpoint) {
  try {
    const response = await fetch(`${BIBLE_API_URL}${endpoint}`, {
      headers: {
        'api-key': API_KEY,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      if (response.status === 403) {
        throw new Error(`Bible version not available in ${currentLanguage === 'tel' ? 'Telugu' : 'English'}`);
      }
      throw new Error(`API Error: ${response.status} - ${errorData.message || 'Unknown error'}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching from API:', error);
    showError(`Error: ${error.message}`);
    return null;
  }
}

function setupBibleVerseSelectors() {
  const bookSelect = document.getElementById('book-select');
  const chapterSelect = document.getElementById('chapter-select');
  const verseSelect = document.getElementById('verse-select');

  fetchBooks();

  bookSelect.addEventListener('change', () => {
    fetchChapters(bookSelect.value);
    updateAddToCartButton();
  });

  chapterSelect.addEventListener('change', () => {
    fetchVerses(chapterSelect.value);
    updateAddToCartButton();
  });

  verseSelect.addEventListener('change', () => {
    fetchVerseContent(verseSelect.value);
    updateAddToCartButton();
  });
}

function setupLanguageToggle() {
  const languageButtons = document.querySelectorAll('.language-btn');
  
  languageButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      
      languageButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      currentLanguage = btn.dataset.lang;
      updateDisclaimerVisibility(currentLanguage);
      fetchBooks();
    });
  });
}

async function fetchBooks() {
  showLoading();
  const bookSelect = document.getElementById('book-select');
  bookSelect.innerHTML = '<option value="">-- Select Book --</option>';
  
  const data = await fetchFromAPI(`/bibles/${BIBLE_IDS[currentLanguage]}/books`);
  if (data && data.data) {
    data.data.forEach(book => {
      const option = document.createElement('option');
      option.value = book.id;
      option.textContent = book.name;
      bookSelect.appendChild(option);
    });
  }
  hideLoading();
}

async function fetchChapters(bookId) {
  showLoading();
  const chapterSelect = document.getElementById('chapter-select');
  chapterSelect.innerHTML = '<option value="">-- Select Chapter --</option>';
  chapterSelect.disabled = !bookId;
  
  if (bookId) {
    const data = await fetchFromAPI(`/bibles/${BIBLE_IDS[currentLanguage]}/books/${bookId}/chapters`);
    if (data && data.data) {
      data.data.forEach(chapter => {
        if (chapter.number) {
          const option = document.createElement('option');
          option.value = chapter.id;
          option.textContent = chapter.number;
          chapterSelect.appendChild(option);
        }
      });
      chapterSelect.disabled = false;
    }
  }
  hideLoading();
}

async function fetchVerses(chapterId) {
  showLoading();
  const verseSelect = document.getElementById('verse-select');
  verseSelect.innerHTML = '<option value="">-- Select Verse --</option>';
  verseSelect.disabled = !chapterId;
  
  if (chapterId) {
    const data = await fetchFromAPI(`/bibles/${BIBLE_IDS[currentLanguage]}/chapters/${chapterId}/verses`);
    if (data && data.data) {
      data.data.forEach(verse => {
        const option = document.createElement('option');
        option.value = verse.id;
        option.textContent = verse.reference;
        verseSelect.appendChild(option);
      });
      verseSelect.disabled = false;
    }
  }
  hideLoading();
}

async function fetchVerseContent(verseId) {
  showLoading();
  
  if (!verseId) {
    document.getElementById('verse-text').textContent = 'Please select a Bible verse to display.';
    document.getElementById('verse-reference').textContent = '';
    hideLoading();
    return;
  }
  
  const data = await fetchFromAPI(`/bibles/${BIBLE_IDS[currentLanguage]}/verses/${verseId}?content-type=text`);
  if (data && data.data) {
    const content = data.data.content.replace(/<[^>]*>/g, '').trim();
    document.getElementById('verse-text').textContent = content;
    document.getElementById('verse-reference').textContent = data.data.reference;
  }
  hideLoading();
}

function showLoading() {
  const loadingIndicator = document.getElementById('loading-indicator');
  if (loadingIndicator) loadingIndicator.style.display = 'flex';
}

function hideLoading() {
  const loadingIndicator = document.getElementById('loading-indicator');
  if (loadingIndicator) loadingIndicator.style.display = 'none';
}

function showError(message) {
  const errorMessage = document.getElementById('error-message');
  if (errorMessage) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
  }
}

function updateAddToCartButton() {
  const addToCartBtn = document.querySelector('.add-to-cart-btn');
  if (isCustomText) {
    const customText = document.getElementById('frameText').value.trim();
    addToCartBtn.disabled = !customText;
  } else {
    const verseSelect = document.getElementById('verse-select');
    addToCartBtn.disabled = !verseSelect.value;
  }
}

function setupNavigation() {
  const menuToggle = document.querySelector('.menu-toggle');
  const navClose = document.querySelector('.nav-close');
  const mainNav = document.querySelector('.main-nav');

  if (menuToggle && navClose && mainNav) {
    menuToggle.addEventListener('click', () => {
      mainNav.classList.add('active');
    });

    navClose.addEventListener('click', () => {
      mainNav.classList.remove('active');
    });

    document.addEventListener('click', (e) => {
      if (!mainNav.contains(e.target) && !menuToggle.contains(e.target)) {
        mainNav.classList.remove('active');
      }
    });
  }
}

function subscribeToCartUpdates(userId) {
  if (unsubscribe) {
    unsubscribe();
  }

  const userRef = doc(db, "users", userId);
  unsubscribe = onSnapshot(userRef, (doc) => {
    if (doc.exists()) {
      const userData = doc.data();
      updateCartCount(userData.cart || []);
    }
  });
}

function setupTextInput() {
  const frameText = document.getElementById('frameText');
  const verseText = document.getElementById('verse-text');
  const addToCartBtn = document.querySelector('.add-to-cart-btn');

  frameText.addEventListener('input', () => {
    const text = frameText.value.trim();
    verseText.textContent = text;
    addToCartBtn.disabled = !text;
  });
}

function setupSizeSelector() {
  const sizeButtons = document.querySelectorAll('.size-btn');
  const framePriceDisplay = document.querySelector('.frame-price');
  
  sizeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      sizeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedSize = btn.dataset.size;
      const price = framePrices[selectedSize];
      framePriceDisplay.textContent = `₹${price.toLocaleString()}`;
    });
  });
}

function showToast(message, isSuccess = true) {
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <i class="fas ${isSuccess ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
    ${message}
  `;
  document.body.appendChild(toast);

  toast.addEventListener('animationend', (e) => {
    if (e.animationName === 'fadeOut') {
      toast.remove();
    }
  });
}

async function handleAddToCart() {
  const userId = sessionStorage.getItem('loggedInUserId');
  if (!userId) return;

  let frameText, verseReference;
  if (isCustomText) {
    frameText = document.getElementById('frameText').value.trim();
    verseReference = '';
  } else {
    frameText = document.getElementById('verse-text').textContent;
    verseReference = document.getElementById('verse-reference').textContent;
  }

  const addToCartBtn = document.querySelector('.add-to-cart-btn');

  if (!frameText) {
    showToast('Please enter your text or select a Bible verse first', false);
    return;
  }

  addToCartBtn.disabled = true;
  addToCartBtn.classList.add('loading');

  const frameItem = {
    id: Date.now().toString(),
    name: 'Custom Frame',
    price: framePrices[selectedSize],
    customText: frameText,
    verseReference: verseReference,
    size: selectedSize,
    image: generateTextImage(frameText),
    quantity: 1,
    isCustomFrame: true
  };

  try {
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const cart = userData.cart || [];
      cart.push(frameItem);
      await updateDoc(userRef, { cart });
      
      showToast('Added to cart!');
      
      if (isCustomText) {
        document.getElementById('frameText').value = '';
        document.getElementById('verse-text').textContent = '';
      } else {
        document.getElementById('book-select').value = '';
        document.getElementById('chapter-select').value = '';
        document.getElementById('verse-select').value = '';
        document.getElementById('verse-text').textContent = '';
        document.getElementById('verse-reference').textContent = '';
      }
      addToCartBtn.disabled = true;
    }
  } catch (error) {
    console.error('Error adding to cart:', error);
    showToast('Failed to add frame to cart. Please try again.', false);
  } finally {
    addToCartBtn.disabled = false;
    addToCartBtn.classList.remove('loading');
  }
}

function generateTextImage(text) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 400;
  canvas.height = 300;

  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#2c4a7c';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = '20px "Playfair Display"';
  const words = text.split(' ');
  let lines = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + " " + word).width;
    if (width < canvas.width - 40) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);

  let y = 150 - (lines.length * 15);
  lines.forEach(line => {
    ctx.fillText(line, canvas.width/2, y);
    y += 30;
  });

  return canvas.toDataURL();
}

function updateCartCount(cart) {
  const cartCount = document.querySelector('.cart-count');
  if (cartCount) {
    cartCount.textContent = cart.reduce((total, item) => total + item.quantity, 0);
  }
}

const framePrices = {
  "8x12": 200,
  "10x15": 320,
  "8x18": 280,
  "12x18": 380,
  "12x24": 700,
  "18x36": 2800
};

// Add event listener for the Add to Cart button
document.querySelector('.add-to-cart-btn')?.addEventListener('click', handleAddToCart);

// Cleanup on page unload
window.addEventListener('unload', () => {
  if (unsubscribe) {
    unsubscribe();
  }
});
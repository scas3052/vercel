import { db } from './firebase-config.js';
import { doc, getDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

let unsubscribe = null;

document.addEventListener('DOMContentLoaded', () => {
  // Check authentication first
  if (!window.auth.checkAuth()) return;
  
  const userId = sessionStorage.getItem('loggedInUserId');
  if (userId) {
    // Subscribe to real-time cart updates
    subscribeToCartUpdates(userId);
    setupNavigation();
  }
});

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

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!mainNav.contains(e.target) && !menuToggle.contains(e.target)) {
        mainNav.classList.remove('active');
      }
    });
  }
}

function subscribeToCartUpdates(userId) {
  // Unsubscribe from previous listener if exists
  if (unsubscribe) {
    unsubscribe();
  }

  const userRef = doc(db, "users", userId);
  unsubscribe = onSnapshot(userRef, (doc) => {
    if (doc.exists()) {
      const userData = doc.data();
      const cart = userData.cart || [];
      renderCart(cart);
      updateCartCount(cart);
    }
  });
}

function renderCart(cart) {
  const cartItems = document.getElementById('cart-items');
  const cartSummary = document.querySelector('.cart-summary');
  
  if (cart.length === 0) {
    cartItems.innerHTML = `
      <div class="empty-cart">
        <i class="fas fa-shopping-cart"></i>
        <h2>Your cart is empty</h2>
        <p>Add some beautiful frames to your cart</p>
        <a href="homepage.html" class="shop-now-btn">Shop Now</a>
      </div>
    `;
    cartSummary.style.display = 'none';
    return;
  }
  
  cartSummary.style.display = 'block';
  cartItems.innerHTML = cart.map(item => `
    <div class="cart-item" data-id="${item.id}">
      <img src="${item.image}" alt="${item.name}">
      <div class="item-details">
        <h3>${item.name}</h3>
        <p class="item-price">₹${item.price.toLocaleString()}</p>
        <div class="quantity-controls">
          <button class="quantity-btn" onclick="updateQuantity('${item.id}', -1, ${item.isCustomFrame || false})">-</button>
          <span class="quantity">${item.quantity}</span>
          <button class="quantity-btn" onclick="updateQuantity('${item.id}', 1, ${item.isCustomFrame || false})">+</button>
        </div>
      </div>
      <div class="item-actions">
        <button class="remove-item" onclick="removeItem('${item.id}', ${item.isCustomFrame || false})">
          <i class="fas fa-trash"></i>
        </button>
        <a href="checkout.html?item=${item.id}" class="item-checkout-btn">
          <i class="fas fa-shopping-bag"></i>
          Buy Now
        </a>
      </div>
    </div>
  `).join('');
  
  updateCartSummary(cart);
}

async function updateQuantity(itemId, change, isCustomFrame) {
  if (!window.auth.checkAuth()) return;
  
  const userId = sessionStorage.getItem('loggedInUserId');
  const userRef = doc(db, "users", userId);
  
  try {
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      const userData = docSnap.data();
      const cart = userData.cart || [];
      
      // For custom frames, compare as strings since they use timestamp IDs
      const item = isCustomFrame 
        ? cart.find(item => item.id.toString() === itemId.toString())
        : cart.find(item => item.id === itemId);
      
      if (item) {
        item.quantity = Math.max(1, item.quantity + change);
        await updateDoc(userRef, { cart });
      }
    }
  } catch (error) {
    console.error("Error updating quantity:", error);
  }
}

async function removeItem(itemId, isCustomFrame) {
  if (!window.auth.checkAuth()) return;
  
  const userId = sessionStorage.getItem('loggedInUserId');
  const userRef = doc(db, "users", userId);
  
  try {
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      const userData = docSnap.data();
      const cart = userData.cart || [];
      
      // For custom frames, compare as strings since they use timestamp IDs
      const updatedCart = isCustomFrame
        ? cart.filter(item => item.id.toString() !== itemId.toString())
        : cart.filter(item => item.id !== itemId);
      
      await updateDoc(userRef, { cart: updatedCart });
    }
  } catch (error) {
    console.error("Error removing item:", error);
  }
}

function updateCartSummary(cart) {
  const subtotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  const tax = subtotal * 0.18;
  const total = subtotal + tax;
  
  document.getElementById('subtotal').textContent = `₹${subtotal.toLocaleString()}`;
  document.getElementById('tax').textContent = `₹${tax.toLocaleString()}`;
  document.getElementById('total').textContent = `₹${total.toLocaleString()}`;
}

function updateCartCount(cart) {
  const cartCount = document.querySelector('.cart-count');
  if (cartCount) {
    cartCount.textContent = cart.reduce((total, item) => total + item.quantity, 0);
  }
}

// Expose functions to window object
window.updateQuantity = updateQuantity;
window.removeItem = removeItem;

// Cleanup on page unload
window.addEventListener('unload', () => {
  if (unsubscribe) {
    unsubscribe();
  }
});
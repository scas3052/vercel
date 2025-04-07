import { db } from './firebase-config.js';
import { doc, getDoc, updateDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

let frameData = null;
let frameTypeData = null;
let frameSizeImages = [];

document.addEventListener('DOMContentLoaded', () => {
    if (!window.auth.checkAuth()) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const frameId = urlParams.get('id');
    
    if (frameId) {
        loadFrameDetails(frameId);
    } else {
        window.location.href = 'homepage.html';
    }
    
    setupNavigation();
    updateCartCount();
    
    // Remove loading overlay if it exists
    const loadingOverlay = document.querySelector('.frame-loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.remove();
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

        document.addEventListener('click', (e) => {
            if (!mainNav.contains(e.target) && !menuToggle.contains(e.target)) {
                mainNav.classList.remove('active');
            }
        });
    }
}

async function loadFrameDetails(frameId) {
    try {
        // Show loading state
        const mainImage = document.getElementById('mainImage');
        if (mainImage) {
            mainImage.src = 'https://via.placeholder.com/400x400?text=Loading...';
        }
        
        const frameRef = doc(db, "items", frameId);
        const frameDoc = await getDoc(frameRef);
        
        if (!frameDoc.exists()) {
            window.location.href = 'homepage.html';
            return;
        }
        
        frameData = { id: frameDoc.id, ...frameDoc.data() };
        
        // Load frame type data
        if (frameData.material) {
            const frameTypeRef = doc(db, "frameTypes", frameData.material);
            const frameTypeDoc = await getDoc(frameTypeRef);
            
            if (frameTypeDoc.exists()) {
                frameTypeData = { id: frameTypeDoc.id, ...frameTypeDoc.data() };
            }
        }
        
        // Load frame size images
        await loadFrameSizeImages(frameData.size);
        
        renderFrameDetails();
        setupEventListeners();
    } catch (error) {
        console.error("Error loading frame details:", error);
    }
}

async function loadFrameSizeImages(size) {
    try {
        const frameSizesRef = collection(db, "frameSizes");
        const snapshot = await getDocs(frameSizesRef);
        
        snapshot.forEach(doc => {
            const sizeData = doc.data();
            if (sizeData.size === size && sizeData.images && sizeData.images.length > 0) {
                frameSizeImages = sizeData.images;
            }
        });
    } catch (error) {
        console.error("Error loading frame size images:", error);
    }
}

function renderFrameDetails() {
    if (!frameData) return;
    
    // Set frame name and price
    document.getElementById('frameName').textContent = frameData.name;
    document.getElementById('framePrice').textContent = frameData.price.toLocaleString();
    
    // Set stock status
    const stockElement = document.getElementById('frameStock');
    if (frameData.stock <= 0) {
        stockElement.textContent = 'Out of Stock';
        stockElement.className = 'frame-stock out-of-stock';
        document.getElementById('addToCartBtn').disabled = true;
    } else if (frameData.stock <= 5) {
        stockElement.textContent = `Only ${frameData.stock} left in stock!`;
        stockElement.className = 'frame-stock low-stock';
    } else {
        stockElement.textContent = `${frameData.stock} in stock`;
        stockElement.className = 'frame-stock in-stock';
    }
    
    // Set frame description
    document.getElementById('frameDescription').textContent = frameData.description;
    
    // Set specifications
    document.getElementById('frameSize').textContent = frameData.size;
    
    // Set frame type info
    if (frameTypeData) {
        document.getElementById('frameMaterial').textContent = frameTypeData.name;
        document.getElementById('frameTypeDescription').textContent = frameTypeData.description;
    } else {
        document.getElementById('frameMaterial').textContent = 'Standard';
        document.getElementById('frameTypeDescription').textContent = 'Standard frame type';
    }
    
    // Set main image
    const mainImage = document.getElementById('mainImage');
    mainImage.src = frameData.image;
    mainImage.alt = frameData.name;
    
    // Collect all images
    let allImages = [frameData.image];
    
    // Add frame type images
    if (frameTypeData && frameTypeData.images && frameTypeData.images.length > 0) {
        allImages = [...allImages, ...frameTypeData.images];
    }
    
    // Add frame size images
    if (frameSizeImages.length > 0) {
        allImages = [...allImages, ...frameSizeImages];
    }
    
    // Filter out duplicates and empty values
    allImages = [...new Set(allImages)].filter(img => img && img.trim() !== '');
    
    // Set thumbnails
    const thumbnailList = document.getElementById('thumbnailList');
    let thumbnailsHtml = allImages.map((imageUrl, index) => `
        <div class="thumbnail ${index === 0 ? 'active' : ''}" onclick="changeMainImage('${imageUrl}', this)">
            <img src="${imageUrl}" alt="${frameData.name} - View ${index + 1}">
        </div>
    `).join('');
    
    thumbnailList.innerHTML = thumbnailsHtml;
}

function setupEventListeners() {
    const addToCartBtn = document.getElementById('addToCartBtn');
    
    addToCartBtn.addEventListener('click', async () => {
        if (!frameData || frameData.stock <= 0) return;
        
        addToCartBtn.disabled = true;
        addToCartBtn.classList.add('loading');
        
        try {
            const userId = sessionStorage.getItem('loggedInUserId');
            if (!userId) {
                window.location.href = 'index.html';
                return;
            }
            
            const userRef = doc(db, "users", userId);
            const userDoc = await getDoc(userRef);
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const cart = userData.cart || [];
                const existingItem = cart.find(item => item.id === frameData.id);
                
                if (existingItem) {
                    existingItem.quantity += 1;
                } else {
                    cart.push({
                        id: frameData.id,
                        name: frameData.name,
                        price: frameData.price,
                        image: frameData.image,
                        quantity: 1
                    });
                }
                
                await updateDoc(userRef, { cart });
                updateCartCount();
                
                showToast('Added to cart!');
            }
        } catch (error) {
            console.error("Error adding to cart:", error);
            showToast('Failed to add to cart', false);
        } finally {
            addToCartBtn.disabled = false;
            addToCartBtn.classList.remove('loading');
        }
    });
}

window.changeMainImage = function(imageUrl, thumbnailElement) {
    const mainImage = document.getElementById('mainImage');
    mainImage.src = imageUrl;
    
    // Update active thumbnail
    document.querySelectorAll('.thumbnail').forEach(thumb => {
        thumb.classList.remove('active');
    });
    thumbnailElement.classList.add('active');
};

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

async function updateCartCount() {
    const cartCount = document.querySelector('.cart-count');
    const userId = sessionStorage.getItem('loggedInUserId');
    
    if (userId) {
        const userRef = doc(db, "users", userId);
        const docSnap = await getDoc(userRef);
        
        if (docSnap.exists()) {
            const userData = docSnap.data();
            const cart = userData.cart || [];
            if (cartCount) {
                cartCount.textContent = cart.reduce((total, item) => total + item.quantity, 0);
            }
        }
    }
}
import { db } from './firebase-config.js';
import { doc, getDoc, updateDoc, collection, query, orderBy, onSnapshot, getDocs } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

let unsubscribeProducts = null;
let frameTypes = [];
let currentView = 'frames';

document.addEventListener('DOMContentLoaded', () => {
    if (!window.auth.checkAuth()) return;
    loadFrameTypes();
    setupProductsListener();
    setupFilterToggle();
    setupFilters();
    updateCartCount();
});

function setupFilterToggle() {
    const filterToggle = document.querySelector('.filter-toggle');
    const filtersSection = document.querySelector('.filters-section');
    
    if (filterToggle && filtersSection) {
        filterToggle.addEventListener('click', () => {
            filtersSection.classList.toggle('active');
            filterToggle.classList.toggle('active');
            const icon = filterToggle.querySelector('i');
            icon.classList.toggle('fa-times');
            icon.classList.toggle('fa-filter');
        });

        document.addEventListener('click', (e) => {
            if (!filtersSection.contains(e.target) && !filterToggle.contains(e.target)) {
                filtersSection.classList.remove('active');
                filterToggle.classList.remove('active');
                const icon = filterToggle.querySelector('i');
                icon.classList.remove('fa-times');
                icon.classList.add('fa-filter');
            }
        });
    }
}

function setupFilters() {
    const searchInput = document.getElementById('search-input');
    const priceFilter = document.getElementById('price-filter');
    const sizeFilter = document.getElementById('size-filter');
    const materialFilter = document.getElementById('material-filter');
    const styleFilter = document.getElementById('style-filter');

    const filters = [searchInput, priceFilter, sizeFilter, materialFilter, styleFilter];

    filters.forEach(filter => {
        if (filter) {
            filter.addEventListener('change', refreshProducts);
            if (filter === searchInput) {
                filter.addEventListener('input', refreshProducts);
            }
        }
    });
}

document.getElementById('size-filter').innerHTML = `
    <option value="">All Sizes</option>
    <option value="8x12">8" x 12"</option>
    <option value="10x15">10" x 15"</option>
    <option value="8x18">8" x 18"</option>
    <option value="12x18">12" x 18"</option>
    <option value="12x24">12" x 24"</option>
    <option value="18x36">18" x 36" (Premium)</option>
`;

async function loadFrameTypes() {
    try {
        const frameTypesRef = collection(db, "frameTypes");
        const snapshot = await getDocs(frameTypesRef);
        frameTypes = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.images && Array.isArray(data.images) && data.images.length > 0) {
                frameTypes.push({ 
                    id: doc.id, 
                    ...data,
                    images: data.images.filter(img => img && typeof img === 'string' && img.trim() !== '')
                });
            }
        });
        
        const materialFilter = document.getElementById('material-filter');
        if (materialFilter) {
            materialFilter.innerHTML = `
                <option value="">All Materials</option>
                ${frameTypes.map(type => `
                    <option value="${type.id}">${type.name}</option>
                `).join('')}
            `;
        }

        refreshProducts();
    } catch (error) {
        console.error("Error loading frame types:", error);
    }
}

async function refreshProducts() {
    const itemsRef = collection(db, "items");
    const q = query(itemsRef, orderBy("timestamp", "desc"));
    const snapshot = await getDocs(q);
    
    const products = [];
    snapshot.forEach(doc => {
        products.push({ id: doc.id, ...doc.data() });
    });
    
    renderProducts(products);
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

function setupProductsListener() {
    if (unsubscribeProducts) {
        unsubscribeProducts();
    }

    const itemsRef = collection(db, "items");
    const q = query(itemsRef, orderBy("timestamp", "desc"));
    
    unsubscribeProducts = onSnapshot(q, (snapshot) => {
        let products = [];
        snapshot.forEach(doc => {
            products.push({ id: doc.id, ...doc.data() });
        });
        renderProducts(products);
    }, (error) => {
        console.error("Error listening to products:", error);
        const productsGrid = document.querySelector('.products-grid');
        if (productsGrid) {
            productsGrid.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i>
                    <h3>Error loading frames</h3>
                    <p>Please try again later</p>
                </div>
            `;
        }
    });
}

function renderProducts(products) {
    const productsGrid = document.querySelector('.products-grid');
    if (!productsGrid) return;

    try {
        const priceFilter = document.getElementById('price-filter')?.value;
        const sizeFilter = document.getElementById('size-filter')?.value;
        const materialFilter = document.getElementById('material-filter')?.value;
        const styleFilter = document.getElementById('style-filter')?.value;
        const searchQuery = document.getElementById('search-input')?.value.toLowerCase();

        let filteredProducts = [...products];

        if (searchQuery) {
            filteredProducts = filteredProducts.filter(product => 
                product.name?.toLowerCase().includes(searchQuery) ||
                product.description?.toLowerCase().includes(searchQuery)
            );
        }

        if (priceFilter) {
            const [min, max] = priceFilter.split('-').map(Number);
            filteredProducts = filteredProducts.filter(product => {
                if (max) {
                    return product.price >= min && product.price <= max;
                }
                return product.price >= min;
            });
        }

        if (sizeFilter) {
            filteredProducts = filteredProducts.filter(product => 
                product.size?.toLowerCase().includes(sizeFilter.toLowerCase())
            );
        }

        if (materialFilter) {
            filteredProducts = filteredProducts.filter(product => 
                product.material?.toLowerCase() === materialFilter.toLowerCase()
            );
        }

        if (styleFilter) {
            filteredProducts = filteredProducts.filter(product => 
                product.style?.toLowerCase() === styleFilter.toLowerCase()
            );
        }

        if (filteredProducts.length === 0) {
            productsGrid.innerHTML = `
                <div class="no-products-message">
                    <i class="fas fa-box-open"></i>
                    <h3>No frames found</h3>
                    <p>Try adjusting your filters</p>
                </div>
            `;
            return;
        }

        // Get frame type images for each product
        const productsWithImages = filteredProducts.map(product => {
            const frameType = frameTypes.find(type => type.id === product.material);
            return {
                ...product,
                frameTypeImages: frameType ? frameType.images : []
            };
        });

        productsGrid.innerHTML = productsWithImages.map(product => `
            <div class="product-card">
                <a href="frame-details.html?id=${product.id}" class="product-link" onclick="showFrameLoading(event)">
                    <div class="product-gallery">
                        <div class="gallery-container">
                            <div class="gallery-main">
                                <img src="${product.image || 'https://via.placeholder.com/400x400?text=Image+Not+Found'}" 
                                     alt="${product.name}"
                                     class="active"
                                     onerror="this.src='https://via.placeholder.com/400x400?text=Image+Not+Found'">
                            </div>
                        </div>
                        ${product.stock <= 0 ? `
                            <div class="out-of-stock-overlay">
                                Out of Stock
                            </div>
                        ` : ''}
                    </div>
                </a>
                <div class="product-info">
                    <a href="frame-details.html?id=${product.id}" class="product-title-link" onclick="showFrameLoading(event)">
                        <h3>${product.name}</h3>
                    </a>
                    <p class="price">₹${product.price.toLocaleString()}</p>
                    <p class="dimensions">${product.size}</p>
                    <p class="description">${product.description}</p>
                    <p class="stock-status ${product.stock <= 5 ? 'low-stock' : ''}">
                        ${product.stock <= 0 ? 'Out of Stock' : 
                        product.stock <= 5 ? `Only ${product.stock} left in stock!` : 
                        `${product.stock} in stock`}
                    </p>
                    <button 
                        onclick="addToCart('${product.id}'); event.preventDefault();" 
                        class="add-to-cart" 
                        id="addToCart-${product.id}"
                        ${product.stock <= 0 ? 'disabled' : ''}
                    >
                        <span class="spinner"></span>
                        <span class="button-text">
                            <i class="fas fa-shopping-cart"></i>
                            ${product.stock <= 0 ? 'Out of Stock' : 'Add to Cart'}
                        </span>
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error("Error rendering products:", error);
        productsGrid.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Error loading frames</h3>
                <p>Please try again later</p>
            </div>
        `;
    }
}

window.showFrameLoading = function(event) {
    // Create and show the loading overlay
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'frame-loading-overlay';
    loadingOverlay.innerHTML = `
        <div class="frame-loading-spinner"></div>
        <p>Loading frame details...</p>
    `;
    document.body.appendChild(loadingOverlay);
    
    // Don't prevent default - let the navigation happen
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

window.addToCart = async function(productId) {
    const userId = sessionStorage.getItem('loggedInUserId');
    if (!userId) return;

    const button = document.getElementById(`addToCart-${productId}`);
    if (!button || button.disabled) return;

    button.disabled = true;
    button.classList.add('loading');

    try {
        const productRef = doc(db, "items", productId);
        const productSnap = await getDoc(productRef);
        
        if (productSnap.exists()) {
            const product = productSnap.data();
            const userRef = doc(db, "users", userId);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                const userData = userSnap.data();
                const cart = userData.cart || [];
                const existingItem = cart.find(item => item.id === productId);
                
                if (existingItem) {
                    existingItem.quantity += 1;
                } else {
                    cart.push({
                        id: productId,
                        name: product.name,
                        price: product.price,
                        image: product.image,
                        quantity: 1
                    });
                }
                
                await updateDoc(userRef, { cart });
                updateCartCount();
                
                showToast('Added to cart!', true);
            }
        }
    } catch (error) {
        console.error("Error adding to cart:", error);
        showToast('Failed to add to cart. Please try again.', false);
    } finally {
        button.disabled = false;
        button.classList.remove('loading');
    }
};

window.addEventListener('unload', () => {
    if (unsubscribeProducts) {
        unsubscribeProducts();
    }
});
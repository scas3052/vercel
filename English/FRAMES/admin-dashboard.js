import { db, auth } from './firebase-config.js';
import { doc, getDoc, updateDoc, collection, query, orderBy, onSnapshot, getDocs, addDoc, Timestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";

let allOrders = [];
let editingItemId = null;
let editingFrameTypeId = null;
let currentFilter = 'all';
let frameTypes = [];
let unreadMessageCount = 0; // New variable to track total unread messages

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication first
    if (!sessionStorage.getItem('adminLoggedIn')) {
        window.location.href = 'admin-login.html';
        return;
    }

    loadOrders();
    loadItems();
    loadFrameTypes();
    setupEventListeners();
    setupNavigation();
    setupAdminUnreadMessagesListener(); // Add this line
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

function setupEventListeners() {
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Filters
    document.getElementById('searchOrders')?.addEventListener('input', filterOrders);
    document.getElementById('searchItems')?.addEventListener('input', filterItems);

    // Order Status Filter Buttons
    const statusFilterBtns = document.querySelectorAll('.status-filter-btn');
    statusFilterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            statusFilterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.status;
            filterOrders();
        });
    });

    // Navigation
    const navButtons = document.querySelectorAll('.nav-btn[data-section]');
    navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (btn.dataset.section) {
                e.preventDefault();
                navButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const section = btn.dataset.section;
                document.getElementById('ordersSection').style.display = section === 'orders' ? 'block' : 'none';
                document.getElementById('itemsSection').style.display = section === 'items' ? 'block' : 'none';
                
                if (section === 'items') {
                    loadItems();
                }
            }
        });
    });

    // Item Form
    const itemForm = document.getElementById('itemForm');
    if (itemForm) {
        itemForm.addEventListener('submit', handleItemSubmit);
    }

    // Frame Type Form
    const frameTypeForm = document.getElementById('frameTypeForm');
    if (frameTypeForm) {
        frameTypeForm.addEventListener('submit', handleFrameTypeSubmit);
    }
}

function setupAdminUnreadMessagesListener() {
    const chatMetadataRef = collection(db, "chatMetadata");
    onSnapshot(chatMetadataRef, (snapshot) => {
        unreadMessageCount = 0;
        snapshot.forEach(doc => {
            const data = doc.data();
            // Only count messages from users to admin that are unread
            if (data.unreadCount && data.lastMessage && data.lastMessage.sender === 'user') {
                unreadMessageCount += data.unreadCount;
            }
        });

        const unreadBadge = document.getElementById('adminUnreadCount');
        const floatingSupportBtn = document.querySelector('.floating-support-btn');
        
        if (unreadBadge && floatingSupportBtn) {
            unreadBadge.textContent = unreadMessageCount;
            floatingSupportBtn.style.display = unreadMessageCount > 0 ? 'flex' : 'flex'; // Always show the button
            console.log("Admin unread count:", unreadMessageCount); // Debug
        } else {
            console.error("Floating support button elements not found");
        }
    }, (error) => {
        console.error("Error listening to unread messages:", error);
    });
}

async function handleLogout() {
    try {
        await signOut(auth);
        sessionStorage.removeItem('adminLoggedIn');
        window.location.href = 'admin-login.html';
    } catch (error) {
        console.error("Error signing out:", error);
    }
}

async function loadItems() {
    try {
        const itemsRef = collection(db, "items");
        const snapshot = await getDocs(itemsRef);
        const itemsGrid = document.getElementById('itemsGrid');
        
        const items = [];
        snapshot.forEach(doc => {
            items.push({ id: doc.id, ...doc.data() });
        });

        itemsGrid.innerHTML = items.map(item => `
            <div class="item-card">
                <div class="item-image">
                    <img src="${item.image}" alt="${item.name}">
                </div>
                <div class="item-info">
                    <h3>${item.name}</h3>
                    <p class="item-price">₹${item.price.toLocaleString()}</p>
                    <p class="item-stock ${item.stock < 10 ? 'low' : ''}">
                        Stock: ${item.stock} units
                    </p>
                    <div class="item-actions">
                        <button class="item-btn edit-item-btn" onclick="editItem('${item.id}')">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="item-btn delete-item-btn" onclick="deleteItem('${item.id}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error("Error loading items:", error);
    }
}

window.showAddItemModal = function() {
    editingItemId = null;
    document.getElementById('itemModalTitle').textContent = 'Add New Item';
    document.getElementById('itemForm').reset();
    document.getElementById('itemModal').classList.add('active');
};

window.closeItemModal = function() {
    document.getElementById('itemModal').classList.remove('active');
    document.getElementById('itemForm').reset();
    editingItemId = null;
};

window.editItem = async function(itemId) {
    try {
        const itemRef = doc(db, 'items', itemId);
        const itemDoc = await getDoc(itemRef);
        
        if (itemDoc.exists()) {
            const item = itemDoc.data();
            editingItemId = itemId;
            
            document.getElementById('itemModalTitle').textContent = 'Edit Item';
            document.getElementById('itemName').value = item.name;
            document.getElementById('itemPrice').value = item.price;
            document.getElementById('itemStock').value = item.stock;
            document.getElementById('itemImage').value = item.image;
            document.getElementById('itemDescription').value = item.description;
            document.getElementById('itemMaterial').value = item.material;
            document.getElementById('itemSize').value = item.size;
            
            document.getElementById('itemModal').classList.add('active');
        }
    } catch (error) {
        console.error("Error loading item:", error);
    }
};

window.deleteItem = async function(itemId) {
    if (!confirm('Are you sure you want to delete this item?')) return;
    
    try {
        await deleteDoc(doc(db, 'items', itemId));
        loadItems();
    } catch (error) {
        console.error("Error deleting item:", error);
    }
};

async function handleItemSubmit(e) {
    e.preventDefault();
    
    const submitButton = e.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    
    const itemData = {
        name: document.getElementById('itemName').value,
        price: Number(document.getElementById('itemPrice').value),
        stock: Number(document.getElementById('itemStock').value),
        image: document.getElementById('itemImage').value,
        description: document.getElementById('itemDescription').value,
        material: document.getElementById('itemMaterial').value,
        size: document.getElementById('itemSize').value,
        timestamp: Timestamp.now()
    };

    try {
        if (editingItemId) {
            await updateDoc(doc(db, 'items', editingItemId), itemData);
        } else {
            await addDoc(collection(db, 'items'), itemData);
        }
        
        closeItemModal();
        loadItems();
        alert(editingItemId ? 'Item updated successfully!' : 'Item added successfully!');
    } catch (error) {
        console.error("Error saving item:", error);
        alert('Error saving item. Please try again.');
    } finally {
        submitButton.disabled = false;
    }
}

function filterItems() {
    const searchQuery = document.getElementById('searchItems').value.toLowerCase();
    const itemCards = document.querySelectorAll('.item-card');
    
    itemCards.forEach(card => {
        const name = card.querySelector('h3').textContent.toLowerCase();
        const visible = name.includes(searchQuery);
        card.style.display = visible ? 'block' : 'none';
    });
}

async function loadOrders() {
    try {
        const usersRef = collection(db, "users");
        const usersSnapshot = await getDocs(usersRef);
        allOrders = [];

        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            if (userData.orders) {
                userData.orders.forEach(order => {
                    allOrders.push({
                        ...order,
                        customerName: `${userData.firstName} ${userData.lastName}`,
                        customerEmail: userData.email,
                        customerPhone: userData.phone || 'Not provided',
                        userId: userDoc.id
                    });
                });
            }
        }

        // Sort orders by date (most recent first)
        allOrders.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        filterOrders();
    } catch (error) {
        console.error("Error loading orders:", error);
    }
}

function filterOrders() {
    const searchQuery = document.getElementById('searchOrders').value.toLowerCase();
    
    let filteredOrders = allOrders;

    // Apply shipping status filter
    if (currentFilter !== 'all') {
        filteredOrders = filteredOrders.filter(order => {
            if (currentFilter === 'pending') return !order.shipped && order.status !== 'Cancelled';
            if (currentFilter === 'shipped') return order.shipped;
            return true;
        });
    }

    // Apply search filter
    if (searchQuery) {
        filteredOrders = filteredOrders.filter(order => 
            order.customerName.toLowerCase().includes(searchQuery) ||
            order.orderNumber.toLowerCase().includes(searchQuery) ||
            order.customerEmail.toLowerCase().includes(searchQuery)
        );
    }

    // Render filtered orders
    const ordersTableBody = document.getElementById('ordersTableBody');
    if (ordersTableBody) {
        ordersTableBody.innerHTML = filteredOrders.map(order => `
            <tr>
                <td>${order.orderNumber}</td>
                <td>${order.customerName}</td>
                <td>${new Date(order.date).toLocaleDateString('en-IN')}</td>
                <td>₹${order.total.toLocaleString()}</td>
                <td><span class="order-status status-${order.status.toLowerCase()}">${order.status}</span></td>
                <td>
                    <span class="shipping-status ${order.shipped ? 'shipped' : 'pending'}">
                        ${order.shipped ? 'Shipped' : 'Pending'}
                    </span>
                    ${!order.shipped && order.status !== 'Cancelled' ? `
                        <button class="ship-btn" onclick="markAsShipped('${order.userId}', '${order.orderNumber}')">
                            Mark as Shipped
                        </button>
                    ` : ''}
                </td>
                <td>
                    <button class="view-details-btn" onclick="viewOrderDetails('${order.orderNumber}')">
                        View Details
                    </button>
                </td>
            </tr>
        `).join('');
    }
}

window.markAsShipped = async function(userId, orderNumber) {
    const shipBtn = document.querySelector(`button[onclick="markAsShipped('${userId}', '${orderNumber}')"]`);
    if (!shipBtn || shipBtn.classList.contains('loading')) return;

    try {
        // Add loading state
        shipBtn.classList.add('loading');
        shipBtn.disabled = true;
        const originalText = shipBtn.innerHTML;
        
        const userRef = doc(db, "users", userId);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            const updatedOrders = userData.orders.map(order => {
                if (order.orderNumber === orderNumber) {
                    return { ...order, shipped: true };
                }
                return order;
            });
            
            await updateDoc(userRef, { orders: updatedOrders });
            loadOrders();
        }
    } catch (error) {
        console.error("Error marking order as shipped:", error);
        // Restore button state on error
        shipBtn.classList.remove('loading');
        shipBtn.disabled = false;
        shipBtn.innerHTML = originalText;
    }
};

window.viewOrderDetails = function(orderNumber) {
    const order = allOrders.find(o => o.orderNumber === orderNumber);
    if (!order) return;

    const modalContent = document.getElementById('orderModalContent');
    modalContent.innerHTML = `
        <div class="order-info-grid">
            <div class="info-group">
                <h4>Order Information</h4>
                <p><strong>Order Number:</strong> ${order.orderNumber}</p>
                <p><strong>Date:</strong> ${new Date(order.date).toLocaleString('en-IN')}</p>
                <p><strong>Status:</strong> ${order.status}</p>
                <p><strong>Shipping Status:</strong> ${order.shipped ? 'Shipped' : 'Pending'}</p>
                <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
                ${order.paymentId ? `<p><strong>Payment ID:</strong> ${order.paymentId}</p>` : ''}
            </div>
            <div class="info-group">
                <h4>Customer Information</h4>
                <p><strong>Name:</strong> ${order.customerName}</p>
                <p><strong>Email:</strong> ${order.customerEmail}</p>
                <p><strong>Phone:</strong> ${order.customerPhone}</p>
            </div>
            <div class="info-group">
                <h4>Shipping Address</h4>
                <p><strong>Recipient:</strong> ${order.address.name}</p>
                <p><strong>Phone:</strong> ${order.address.phone}</p>
                <p>${order.address.addressLine1}</p>
                ${order.address.addressLine2 ? `<p>${order.address.addressLine2}</p>` : ''}
                <p>${order.address.city}, ${order.address.state} - ${order.address.pincode}</p>
            </div>
        </div>

        <div class="order-items-list">
            <h4>Order Items</h4>
            ${order.items.map(item => `
                <div class="order-item">
                    <img src="${item.image}" alt="${item.name}">
                    <div class="item-details">
                        <h4>${item.name}</h4>
                        ${item.customText ? `
                            <p class="custom-text">Custom Text: "${item.customText}"</p>
                            ${item.verseReference ? `<p class="verse-reference">Reference: ${item.verseReference}</p>` : ''}
                        ` : ''}
                        <p>Quantity: ${item.quantity}</p>
                    </div>
                    <div class="item-total">
                        ₹${(item.price * item.quantity).toLocaleString()}
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="order-summary">
            <div class="summary-row">
                <span>Subtotal:</span>
                <span>₹${order.subtotal.toLocaleString()}</span>
            </div>
            <div class="summary-row">
                <span>Tax (18%):</span>
                <span>₹${order.tax.toLocaleString()}</span>
            </div>
            <div class="summary-row total">
                <span>Total:</span>
                <span>₹${order.total.toLocaleString()}</span>
            </div>
        </div>
    `;

    document.getElementById('orderModal').classList.add('active');
};

window.closeOrderModal = function() {
    document.getElementById('orderModal').classList.remove('active');
};

function showMessage(message, isError = false) {
    removeMessages();
    
    const messageDiv = document.createElement('div');
    messageDiv.className = isError ? 'error-message' : 'success -message';
    messageDiv.innerHTML = `
        <i class="fas ${isError ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i>
        ${message}
    `;
    
    let container;
    if (document.querySelector('.modal.active')) {
        container = document.querySelector('.modal.active .modal-content');
    } else if (document.getElementById('itemsSection').style.display !== 'none') {
        container = document.querySelector('.section-header');
    } else {
        container = document.querySelector('.admin-container');
    }

    if (container) {
        container.insertAdjacentElement('afterbegin', messageDiv);
        
        setTimeout(() => {
            messageDiv.remove();
        }, 5000);
    }
}

function removeMessages() {
    const messages = document.querySelectorAll('.error-message, .success-message');
    messages.forEach(msg => msg.remove());
}

async function loadFrameTypes() {
    try {
        const frameTypesRef = collection(db, "frameTypes");
        const snapshot = await getDocs(frameTypesRef);
        frameTypes = [];
        snapshot.forEach(doc => {
            frameTypes.push({ id: doc.id, ...doc.data() });
        });

        const materialSelect = document.getElementById('itemMaterial');
        if (materialSelect) {
            materialSelect.innerHTML = `
                <option value="">Select Frame Type</option>
                ${frameTypes.map(type => `
                    <option value="${type.id}">${type.name}</option>
                `).join('')}
            `;
        }
    } catch (error) {
        console.error("Error loading frame types:", error);
        showMessage("Failed to load frame types. Please refresh the page.", true);
    }
}

window.showFrameTypeModal = function() {
    editingFrameTypeId = null;
    document.getElementById('frameTypeModalTitle').textContent = 'Add New Frame Type';
    document.getElementById('frameTypeForm').reset();
    document.getElementById('frameTypeModal').classList.add('active');
};

window.closeFrameTypeModal = function() {
    document.getElementById('frameTypeModal').classList.remove('active');
    document.getElementById('frameTypeForm').reset();
    editingFrameTypeId = null;
};

window.addImageUrlInput = function() {
    const imageUrlInputs = document.getElementById('imageUrlInputs');
    const newInput = document.createElement('div');
    newInput.className = 'image-url-group';
    newInput.innerHTML = `
        <div class="form-group">
            <input type="text" class="frameImageUrl" placeholder="Enter image URL" required>
        </div>
        <a href="https://imgbb.com/" target="_blank" class="convert-image-btn">
            <i class="fas fa-image"></i>
            Convert Image
        </a>
        <button type="button" class="remove-image-btn" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    imageUrlInputs.appendChild(newInput);
};

async function handleFrameTypeSubmit(e) {
    e.preventDefault();
    
    const submitButton = e.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    
    try {
        const name = document.getElementById('frameTypeName').value;
        const description = document.getElementById('frameDescription').value;
        const imageUrls = Array.from(document.getElementsByClassName('frameImageUrl'))
            .map(input => input.value)
            .filter(url => url.trim() !== '');

        if (imageUrls.length === 0) {
            throw new Error('Please add at least one image URL');
        }

        const frameTypeData = {
            name,
            description,
            images: imageUrls,
            timestamp: Timestamp.now()
        };

        if (editingFrameTypeId) {
            await updateDoc(doc(db, 'frameTypes', editingFrameTypeId), frameTypeData);
        } else {
            await addDoc(collection(db, 'frameTypes'), frameTypeData);
        }
        
        closeFrameTypeModal();
        loadFrameTypes();
        showMessage(editingFrameTypeId ? 'Frame type updated successfully!' : 'Frame type added successfully!', false);
    } catch (error) {
        console.error("Error saving frame type:", error);
        showMessage(error.message || 'Error saving frame type. Please try again.', true);
    } finally {
        submitButton.disabled = false;
    }
}

window.showFrameSizeModal = function() {
    document.getElementById('frameSizeModal').classList.add('active');
    document.getElementById('frameSizeForm').reset();
};

window.closeFrameSizeModal = function() {
    document.getElementById('frameSizeModal').classList.remove('active');
    document.getElementById('frameSizeForm').reset();
};

window.addSizeImageUrlInput = function() {
    const imageUrlInputs = document.getElementById('sizeImageUrlInputs');
    const newInput = document.createElement('div');
    newInput.className = 'image-url-group';
    newInput.innerHTML = `
        <div class="form-group">
            <input type="text" class="frameSizeImageUrl" placeholder="Enter image URL" required>
        </div>
        <a href="https://imgbb.com/" target="_blank" class="convert-image-btn">
            <i class="fas fa-image"></i>
            Convert Image
        </a>
        <button type="button" class="remove-image-btn" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    imageUrlInputs.appendChild(newInput);
};

document.getElementById('frameSizeForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const submitButton = e.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    
    try {
        const size = document.getElementById('frameSize').value;
        const imageUrls = Array.from(document.getElementsByClassName('frameSizeImageUrl'))
            .map(input => input.value)
            .filter(url => url.trim() !== '');

        if (imageUrls.length === 0) {
            throw new Error('Please add at least one image URL');
        }

        const frameSizeData = {
            size,
            images: imageUrls,
            timestamp: Timestamp.now()
        };

        const frameSizesRef = collection(db, "frameSizes");
        const q = query(frameSizesRef);
        const snapshot = await getDocs(q);
        const existingSize = snapshot.docs.find(doc => doc.data().size === size);

        if (existingSize) {
            await updateDoc(doc(frameSizesRef, existingSize.id), frameSizeData);
        } else {
            await addDoc(frameSizesRef, frameSizeData);
        }
        
        closeFrameSizeModal();
        showMessage('Frame size images saved successfully!', false);
    } catch (error) {
        console.error("Error saving frame size:", error);
        showMessage(error.message || 'Error saving frame size. Please try again.', true);
    } finally {
        submitButton.disabled = false;
    }
});
import { db } from './firebase-config.js';
import { doc, getDoc, updateDoc, onSnapshot, runTransaction } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

let unsubscribe = null;
let currentCart = [];

document.addEventListener('DOMContentLoaded', () => {
  if (!window.auth.checkAuth()) return;
  
  const userId = sessionStorage.getItem('loggedInUserId');
  if (userId) {
    subscribeToCartUpdates(userId);
    loadUserAddresses(userId);
    setupCheckoutForm();
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

    document.addEventListener('click', (e) => {
      if (!mainNav.contains(e.target) && !menuToggle.contains(e.target)) {
        mainNav.classList.remove('active');
      }
    });
  }
}

function setupCheckoutForm() {
  const placeOrderBtn = document.getElementById('placeOrderBtn');
  if (placeOrderBtn) {
    placeOrderBtn.addEventListener('click', handleCheckout);
  }

  const savedAddressSelect = document.getElementById('saved-addresses');
  if (savedAddressSelect) {
    savedAddressSelect.addEventListener('change', handleAddressSelection);
  }

  const paymentMethods = document.getElementsByName('paymentMethod');
  paymentMethods.forEach(method => {
    method.addEventListener('change', (e) => {
      const buttonText = e.target.value === 'cod' ? 'Place Order' : 'Complete Payment';
      placeOrderBtn.innerHTML = `${buttonText} <i class="fas fa-${e.target.value === 'cod' ? 'box' : 'lock'}"></i>`;
    });
  });
}

function handleAddressSelection(e) {
  const selectedValue = e.target.value;
  const newAddressSection = document.getElementById('new-address-section');
  
  if (selectedValue === 'new') {
    newAddressSection.style.display = 'block';
    document.getElementById('name').value = '';
    document.getElementById('address').value = '';
    document.getElementById('addressLine2').value = '';
    document.getElementById('city').value = '';
    document.getElementById('state').value = '';
    document.getElementById('pincode').value = '';
    document.getElementById('phone').value = '';
  } else if (selectedValue) {
    newAddressSection.style.display = 'none';
  }
}

async function loadUserAddresses(userId) {
  try {
    const userRef = doc(db, "users", userId);
    const docSnap = await getDoc(userRef);
    
    if (docSnap.exists()) {
      const userData = docSnap.data();
      const addresses = userData.addresses || [];
      
      const savedAddressesSelect = document.getElementById('saved-addresses');
      const newAddressSection = document.getElementById('new-address-section');
      
      if (addresses.length > 0) {
        savedAddressesSelect.innerHTML = `
          <option value="">Choose a delivery address</option>
          ${addresses.map(addr => `
            <option value="${addr.id}" ${addr.isDefault ? 'selected' : ''}>
              ${addr.addressLine1}, ${addr.city}, ${addr.state} - ${addr.pincode}
            </option>
          `).join('')}
          <option value="new">+ Add New Address</option>
        `;
        
        const defaultAddress = addresses.find(addr => addr.isDefault);
        if (defaultAddress) {
          newAddressSection.style.display = 'none';
        }
      }
    }
  } catch (error) {
    console.error("Error loading addresses:", error);
    showMessage("Failed to load addresses. Please try again.", true);
  }
}

function showMessage(message, isError = true) {
  removeMessages();
  
  const messageDiv = document.createElement('div');
  messageDiv.className = isError ? 'error-message' : 'success-message';
  messageDiv.innerHTML = `
    <i class="fas ${isError ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i>
    ${message}
  `;
  
  const submitButton = document.querySelector('.place-order-btn');
  submitButton.parentNode.insertBefore(messageDiv, submitButton);

  if (isError) {
    setButtonLoading(submitButton, false);
  }
}

function removeMessages() {
  const existingMessages = document.querySelectorAll('.error-message, .success-message');
  existingMessages.forEach(msg => msg.remove());
}

function setButtonLoading(button, isLoading) {
  if (isLoading) {
    button.disabled = true;
    button.classList.add('loading');
    button.innerHTML = '<span class="button-text">Processing Order...</span>';
  } else {
    button.disabled = false;
    button.classList.remove('loading');
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
    const buttonText = paymentMethod === 'cod' ? 'Place Order' : 'Complete Payment';
    const iconClass = paymentMethod === 'cod' ? 'box' : 'lock';
    button.innerHTML = `${buttonText} <i class="fas fa-${iconClass}"></i>`;
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
      currentCart = userData.cart || [];
      
      // Get the single item ID from URL if it exists
      const urlParams = new URLSearchParams(window.location.search);
      const singleItemId = urlParams.get('item');
      
      if (singleItemId) {
        // Filter cart to only show the selected item
        const selectedItem = currentCart.find(item => item.id === singleItemId);
        if (selectedItem) {
          renderCheckoutItems([selectedItem]);
          updateCartCount([selectedItem]);
        }
      } else {
        // Show all items
        renderCheckoutItems(currentCart);
        updateCartCount(currentCart);
      }
    }
  });
}

function renderCheckoutItems(items) {
  const checkoutItems = document.getElementById('checkout-items');
  if (!checkoutItems) return;

  checkoutItems.innerHTML = items.map(item => `
    <div class="checkout-item">
      <div class="item-image">
        <img src="${item.image}" alt="${item.name}">
      </div>
      <div class="item-details">
        <h3>${item.name}</h3>
        <div class="item-specs">
          <p>Quantity: ${item.quantity}</p>
        </div>
        <div class="item-quantity-price">
          <span class="quantity">Qty: ${item.quantity}</span>
          <span class="price">₹${(item.price * item.quantity).toLocaleString()}</span>
        </div>
      </div>
    </div>
  `).join('');

  updateOrderSummary(items);
}

function updateOrderSummary(items) {
  const subtotal = items.reduce((total, item) => total + (item.price * item.quantity), 0);
  const tax = subtotal * 0.18;
  const total = subtotal + tax;

  document.getElementById('checkout-subtotal').textContent = `₹${subtotal.toLocaleString()}`;
  document.getElementById('checkout-tax').textContent = `₹${tax.toLocaleString()}`;
  document.getElementById('checkout-total').textContent = `₹${total.toLocaleString()}`;
}

function updateCartCount(items) {
  const cartCount = document.querySelector('.cart-count');
  if (cartCount) {
    cartCount.textContent = items.reduce((total, item) => total + item.quantity, 0);
  }
}

async function handleCheckout(e) {
  e.preventDefault();

  const userId = sessionStorage.getItem('loggedInUserId');
  if (!userId) {
    showMessage('Please sign in to continue', true);
    return;
  }

  const submitButton = document.querySelector('.place-order-btn');
  if (!submitButton) return;
  
  setButtonLoading(submitButton, true);
  removeMessages();

  try {
    // Get the single item ID from URL if it exists
    const urlParams = new URLSearchParams(window.location.search);
    const singleItemId = urlParams.get('item');
    
    // Determine which items to process
    let itemsToProcess;
    if (singleItemId) {
      const selectedItem = currentCart.find(item => item.id === singleItemId);
      if (!selectedItem) {
        throw new Error('Selected item not found in cart');
      }
      itemsToProcess = [selectedItem];
    } else {
      itemsToProcess = currentCart;
    }

    // Validate items
    if (itemsToProcess.length === 0) {
      throw new Error('No items to checkout');
    }

    // Get user data
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
      throw new Error('User data not found');
    }
    const userData = userDoc.data();

    // Get address data
    const addressData = await getAddressData(userData);
    if (!addressData) {
      throw new Error('Please select or enter a delivery address');
    }

    // Calculate order totals
    const subtotal = itemsToProcess.reduce((total, item) => total + (item.price * item.quantity), 0);
    const tax = subtotal * 0.18;
    const total = subtotal + tax;

    // Create order object
    const orderNumber = `ORD${Date.now()}`;
    const order = {
      id: orderNumber,
      orderNumber,
      items: itemsToProcess.map(item => ({...item})), // Create a deep copy of items
      address: addressData,
      subtotal,
      tax,
      total,
      status: 'Pending',
      date: new Date().toISOString(),
      customerName: addressData.name || `${userData.firstName} ${userData.lastName}`,
      customerPhone: addressData.phone
    };

    // Get payment method
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;

    if (paymentMethod === 'cod') {
      await processCODOrder(order, userRef, userData, singleItemId);
    } else {
      await processOnlinePayment(order, userRef, userData, singleItemId);
    }

  } catch (error) {
    console.error('Checkout error:', error);
    showMessage(error.message || 'An error occurred while processing your order. Please try again.', true);
    setButtonLoading(submitButton, false);
  }
}

async function getAddressData(userData) {
  const savedAddressSelect = document.getElementById('saved-addresses');
  
  if (savedAddressSelect && savedAddressSelect.value && savedAddressSelect.value !== 'new') {
    const addresses = userData.addresses || [];
    const selectedAddress = addresses.find(addr => addr.id === savedAddressSelect.value);
    if (selectedAddress) {
      return {
        ...selectedAddress,
        name: selectedAddress.name || `${userData.firstName} ${userData.lastName}`
      };
    }
  }

  // Validate new address form
  const name = document.getElementById('name').value;
  const addressLine1 = document.getElementById('address').value;
  const city = document.getElementById('city').value;
  const state = document.getElementById('state').value;
  const pincode = document.getElementById('pincode').value;
  const phone = document.getElementById('phone').value;

  if (!addressLine1 || !city || !state || !pincode || !phone) {
    throw new Error('Please fill in all required address fields');
  }

  if (!/^\d{10}$/.test(phone)) {
    throw new Error('Please enter a valid 10-digit phone number');
  }

  if (!/^\d{6}$/.test(pincode)) {
    throw new Error('Please enter a valid 6-digit PIN code');
  }

  const addressData = {
    id: Date.now().toString(),
    name: name || `${userData.firstName} ${userData.lastName}`,
    addressLine1,
    addressLine2: document.getElementById('addressLine2').value || '',
    city,
    state,
    pincode,
    phone
  };

  if (document.getElementById('saveAddress')?.checked) {
    await saveNewAddress(userData.id, addressData);
  }

  return addressData;
}

async function saveNewAddress(userId, addressData) {
  const userRef = doc(db, "users", userId);
  const userDoc = await getDoc(userRef);
  let addresses = userDoc.data().addresses || [];
  
  if (addresses.length === 0) {
    addressData.isDefault = true;
  }
  
  addresses.push(addressData);
  await updateDoc(userRef, { addresses });
}

async function processCODOrder(order, userRef, userData, singleItemId) {
  try {
    showMessage('Processing your order...', false);

    // Update stock in a transaction
    for (const item of order.items) {
      if (!item.isCustomFrame) { // Only update stock for regular items
        const itemRef = doc(db, "items", item.id);
        await runTransaction(db, async (transaction) => {
          const itemDoc = await transaction.get(itemRef);
          if (!itemDoc.exists()) {
            throw new Error(`Item ${item.id} not found`);
          }

          const currentStock = itemDoc.data().stock;
          if (currentStock < item.quantity) {
            throw new Error(`Insufficient stock for ${item.name}`);
          }

          transaction.update(itemRef, {
            stock: currentStock - item.quantity
          });
        });
      }
    }

    order.status = 'Confirmed';
    order.paymentMethod = 'Cash on Delivery';

    // Create a new array with existing orders plus the new one
    const updatedOrders = Array.isArray(userData.orders) ? [...userData.orders] : [];
    updatedOrders.push(order);

    // Update cart by removing processed items
    let updatedCart = [...currentCart];
    if (singleItemId) {
      updatedCart = updatedCart.filter(item => item.id !== singleItemId);
    } else {
      updatedCart = [];
    }

    // Update the document with the new orders array and updated cart
    await updateDoc(userRef, {
      orders: updatedOrders,
      cart: updatedCart
    });

    window.location.href = `order-success.html?orderId=${order.id}`;
  } catch (error) {
    console.error('COD Order Error:', error);
    throw new Error('Error processing your order. Please try again.');
  }
}

async function processOnlinePayment(order, userRef, userData, singleItemId) {
  const options = {
    key: import.meta.env.VITE_RAZORPAY_KEY,
    amount: Math.round(order.total * 100),
    currency: "INR",
    name: "Holy Army Fellowship",
    description: "Frame Purchase",
    prefill: {
      name: order.address.name,
      email: userData.email,
      contact: order.address.phone
    },
    notes: {
      orderId: order.orderNumber,
      userId: userData.id
    },
    handler: async function(response) {
      try {
        showMessage('Payment successful! Processing your order...', false);

        // Update stock in a transaction
        for (const item of order.items) {
          if (!item.isCustomFrame) { // Only update stock for regular items
            const itemRef = doc(db, "items", item.id);
            await runTransaction(db, async (transaction) => {
              const itemDoc = await transaction.get(itemRef);
              if (!itemDoc.exists()) {
                throw new Error(`Item ${item.id} not found`);
              }

              const currentStock = itemDoc.data().stock;
              if (currentStock < item.quantity) {
                throw new Error(`Insufficient stock for ${item.name}`);
              }

              transaction.update(itemRef, {
                stock: currentStock - item.quantity
              });
            });
          }
        }

        order.status = 'Confirmed';
        order.paymentId = response.razorpay_payment_id;
        order.paymentMethod = 'Online Payment';

        // Create a new array with existing orders plus the new one
        const updatedOrders = Array.isArray(userData.orders) ? [...userData.orders] : [];
        updatedOrders.push(order);

        // Update cart by removing processed items
        let updatedCart = [...currentCart];
        if (singleItemId) {
          updatedCart = updatedCart.filter(item => item.id !== singleItemId);
        } else {
          updatedCart = [];
        }

        // Update the document with the new orders array and updated cart
        await updateDoc(userRef, {
          orders: updatedOrders,
          cart: updatedCart
        });

        window.location.href = `order-success.html?orderId=${order.id}`;
      } catch (error) {
        console.error('Payment Processing Error:', error);
        showMessage('Error processing your order. Please try again.', true);
        setButtonLoading(document.querySelector('.place-order-btn'), false);
      }
    },
    modal: {
      ondismiss: function() {
        showMessage('Payment cancelled. Please try again.', true);
        setButtonLoading(document.querySelector('.place-order-btn'), false);
      },
      escape: true,
      confirm_close: true,
      handleback: true,
      onerror: function(error) {
        showMessage(`Payment failed: ${error.description || 'Please try again.'}`, true);
        setButtonLoading(document.querySelector('.place-order-btn'), false);
      }
    }
  };

  const rzp = new Razorpay(options);
  rzp.on('payment.failed', function(response) {
    showMessage(`Payment failed: ${response.error.description}`, true);
    setButtonLoading(document.querySelector('.place-order-btn'), false);
  });
  
  rzp.open();
}

// Cleanup on page unload
window.addEventListener('unload', () => {
  if (unsubscribe) {
    unsubscribe();
  }
});
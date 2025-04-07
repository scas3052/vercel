import { db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { jsPDF } from 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm';

let orderData = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!window.auth.checkAuth()) return;
  
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('orderId');
  
  if (orderId) {
    loadOrderDetails(orderId);
  } else {
    window.location.href = 'homepage.html';
  }
  
  setupNavigation();
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

async function loadOrderDetails(orderId) {
  const userId = sessionStorage.getItem('loggedInUserId');
  if (!userId) return;

  try {
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const order = userData.orders.find(o => o.id === orderId);
      
      if (order) {
        if (!order.address.name) {
          order.address = {
            ...order.address,
            name: `${userData.firstName} ${userData.lastName}`
          };
        }
        orderData = {
          ...order,
          customerName: `${userData.firstName} ${userData.lastName}`
        };
        renderOrderDetails(orderData);
      } else {
        window.location.href = 'homepage.html';
      }
    }
  } catch (error) {
    console.error("Error loading order details:", error);
  }
}

function renderOrderDetails(order) {
  document.getElementById('orderNumber').textContent = order.orderNumber;
  document.getElementById('orderDate').textContent = new Date(order.date).toLocaleString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  document.getElementById('orderStatus').textContent = order.status;
  document.getElementById('paymentMethod').textContent = order.paymentMethod;
  
  // Display payment ID if available
  if (order.paymentId) {
    document.getElementById('paymentIdContainer').style.display = 'block';
    document.getElementById('paymentId').textContent = order.paymentId;
  }

  const addressHtml = `
    <p><strong>${order.address.name}</strong></p>
    <p>${order.address.addressLine1}</p>
    ${order.address.addressLine2 ? `<p>${order.address.addressLine2}</p>` : ''}
    <p>${order.address.city}, ${order.address.state} - ${order.address.pincode}</p>
    <p>Phone: ${order.address.phone}</p>
  `;
  document.getElementById('shippingAddress').innerHTML = addressHtml;

  const itemsHtml = order.items.map(item => `
    <div class="item-card">
      <div class="item-image">
        <img src="${item.image}" alt="${item.name}">
      </div>
      <div class="item-details">
        <h4>${item.name}</h4>
        ${item.customText ? `
          <p class="custom-text">Text: "${item.customText}"</p>
          ${item.verseReference ? `<p class="verse-reference">Reference: ${item.verseReference}</p>` : ''}
        ` : ''}
        <p>Quantity: ${item.quantity}</p>
      </div>
      <div class="item-price">
        ₹${(item.price * item.quantity).toLocaleString()}
      </div>
    </div>
  `).join('');
  document.getElementById('itemsList').innerHTML = itemsHtml;

  document.getElementById('subtotal').textContent = `₹${order.subtotal.toLocaleString()}`;
  document.getElementById('tax').textContent = `₹${order.tax.toLocaleString()}`;
  document.getElementById('total').textContent = `₹${order.total.toLocaleString()}`;
}

window.downloadInvoice = function() {
  if (!orderData) {
    console.error('No order data available');
    return;
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  const addText = (text, x, y, options = {}) => {
    const safeText = text != null ? text.toString() : '';
    doc.text(safeText, x, y, options);
  };

  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  addText('Holy Army Fellowship', pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 10;
  doc.setFontSize(16);
  addText('Invoice', pageWidth / 2, yPos, { align: 'center' });

  yPos += 20;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  addText(`Order #: ${orderData.orderNumber}`, 20, yPos);
  addText(`Date: ${new Date(orderData.date).toLocaleDateString('en-IN')}`, pageWidth - 20, yPos, { align: 'right' });

  yPos += 15;
  doc.setFont('helvetica', 'bold');
  addText('Bill To:', 20, yPos);
  yPos += 7;
  doc.setFont('helvetica', 'normal');
  addText(orderData.address.name, 20, yPos);
  yPos += 7;
  addText(orderData.address.addressLine1, 20, yPos);
  if (orderData.address.addressLine2) {
    yPos += 7;
    addText(orderData.address.addressLine2, 20, yPos);
  }
  yPos += 7;
  addText(`${orderData.address.city}, ${orderData.address.state} - ${orderData.address.pincode}`, 20, yPos);
  yPos += 7;
  addText(`Phone: ${orderData.address.phone}`, 20, yPos);

  yPos += 15;
  doc.setFont('helvetica', 'bold');
  addText('Payment Method:', 20, yPos);
  doc.setFont('helvetica', 'normal');
  addText(orderData.paymentMethod, 100, yPos);
  
  if (orderData.paymentId) {
    yPos += 7;
    doc.setFont('helvetica', 'bold');
    addText('Payment ID:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    addText(orderData.paymentId, 100, yPos);
  }

  yPos += 15;
  doc.setFont('helvetica', 'bold');
  addText('Item', 20, yPos);
  addText('Qty', 120, yPos);
  addText('Price', 160, yPos);
  
  yPos += 5;
  doc.line(20, yPos, pageWidth - 20, yPos);
  
  yPos += 10;
  doc.setFont('helvetica', 'normal');
  orderData.items.forEach(item => {
    addText(item.name, 20, yPos);
    if (item.customText) {
      yPos += 7;
      doc.setFontSize(10);
      addText(`Text: "${item.customText}"`, 20, yPos);
      if (item.verseReference) {
        yPos += 7;
        addText(`Reference: ${item.verseReference}`, 20, yPos);
      }
      doc.setFontSize(12);
    }
    addText(item.quantity, 120, yPos);
    addText(`₹${(item.price * item.quantity).toLocaleString()}`, 160, yPos);
    yPos += item.customText ? 13 : 10;
  });

  yPos += 10;
  doc.line(120, yPos, pageWidth - 20, yPos);
  yPos += 10;
  
  addText('Subtotal:', 120, yPos);
  addText(`₹${orderData.subtotal.toLocaleString()}`, 160, yPos);
  yPos += 10;
  
  addText('Tax (18%):', 120, yPos);
  addText(`₹${orderData.tax.toLocaleString()}`, 160, yPos);
  yPos += 10;
  
  doc.setFont('helvetica', 'bold');
  addText('Total:', 120, yPos);
  addText(`₹${orderData.total.toLocaleString()}`, 160, yPos);

  yPos = doc.internal.pageSize.getHeight() - 30;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  addText('Thank you for your purchase!', pageWidth / 2, yPos, { align: 'center' });

  doc.save(`HAF_Invoice_${orderData.orderNumber}.pdf`);
};
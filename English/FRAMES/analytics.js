import { db, auth } from './firebase-config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";

let usersData = [];

document.addEventListener('DOMContentLoaded', () => {
    // Check admin authentication
    if (!sessionStorage.getItem('adminLoggedIn')) {
        window.location.href = 'admin-login.html';
        return;
    }

    loadAnalytics();
    setupNavigation();
    setupEventListeners();
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
    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        try {
            await signOut(auth);
            sessionStorage.removeItem('adminLoggedIn');
            window.location.href = 'admin-login.html';
        } catch (error) {
            console.error("Error signing out:", error);
        }
    });

    // Export button
    document.getElementById('exportExcelBtn').addEventListener('click', exportToExcel);
}

async function loadAnalytics() {
    try {
        const usersRef = collection(db, "users");
        const usersSnapshot = await getDocs(usersRef);
        usersData = [];
        let totalOrders = 0;
        let totalRevenue = 0;
        let activeUsers = 0;

        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            // Only include users who haven't been deleted
            if (!userData.deleted) {
                const userOrders = userData.orders || [];
                const userRevenue = userOrders.reduce((sum, order) => sum + order.total, 0);
                
                usersData.push({
                    id: doc.id,
                    name: `${userData.firstName} ${userData.lastName}`,
                    email: userData.email,
                    phone: userData.phone || '-',
                    orderCount: userOrders.length,
                    orders: userOrders
                });

                totalOrders += userOrders.length;
                totalRevenue += userRevenue;
                if (userOrders.length > 0) {
                    activeUsers++;
                }
            }
        });

        // Update statistics
        document.getElementById('totalUsers').textContent = usersData.length;
        document.getElementById('activeUsers').textContent = activeUsers;
        document.getElementById('totalOrders').textContent = totalOrders;
        document.getElementById('totalRevenue').textContent = `₹${totalRevenue.toLocaleString()}`;

        // Sort users by name
        usersData.sort((a, b) => a.name.localeCompare(b.name));

        // Update users table
        const usersTableBody = document.querySelector('#usersTable tbody');
        if (usersTableBody) {
            usersTableBody.innerHTML = usersData.map(user => `
                <tr>
                    <td>${user.name}</td>
                    <td>${user.email}</td>
                    <td>${user.phone}</td>
                    <td>${user.orderCount}</td>
                    <td>
                        ${user.orderCount > 0 ? `
                            <button class="view-orders-btn" onclick="showUserOrders('${user.id}')">
                                <i class="fas fa-eye"></i> View Orders
                            </button>
                        ` : '-'}
                    </td>
                </tr>
            `).join('');
        }

    } catch (error) {
        console.error("Error loading analytics:", error);
        alert('Error loading analytics data. Please try refreshing the page.');
    }
}

function exportToExcel() {
    const wb = XLSX.utils.book_new();
    
    const usersWS = XLSX.utils.table_to_sheet(document.getElementById('usersTable'));
    XLSX.utils.book_append_sheet(wb, usersWS, "Users");
    
    if (document.getElementById('userOrdersSection').style.display !== 'none') {
        const ordersWS = XLSX.utils.table_to_sheet(document.getElementById('userOrdersTable'));
        XLSX.utils.book_append_sheet(wb, ordersWS, "Selected User Orders");
    }
    
    XLSX.writeFile(wb, "HAF_Analytics.xlsx");
}

// Make these functions global so they can be called from HTML
window.showUserOrders = function(userId) {
    const user = usersData.find(u => u.id === userId);
    if (!user) return;

    document.getElementById('selectedUserName').textContent = user.name;
    
    const userOrdersTableBody = document.querySelector('#userOrdersTable tbody');
    if (userOrdersTableBody) {
        userOrdersTableBody.innerHTML = user.orders
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .map(order => `
                <tr>
                    <td>${order.orderNumber}</td>
                    <td>${new Date(order.date).toLocaleDateString('en-IN')}</td>
                    <td><span class="order-status status-${order.status.toLowerCase()}">${order.status}</span></td>
                    <td><span class="shipping-status ${order.shipped ? 'shipped' : 'pending'}">${order.shipped ? 'Shipped' : 'Pending'}</span></td>
                    <td>₹${order.total.toLocaleString()}</td>
                </tr>
            `).join('');
    }

    document.getElementById('userOrdersSection').style.display = 'block';
};

window.hideUserOrders = function() {
    document.getElementById('userOrdersSection').style.display = 'none';
};
import { db, auth } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { doc, getDoc, onSnapshot, collection, query, where } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

let unsubscribe = null;
let chatMetadataUnsubscribe = null;

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupNavigation();
    setupHeaderScroll();
});

function setupNavigation() {
    const menuToggle = document.querySelector('.menu-toggle');
    const navClose = document.querySelector('.nav-close');
    const mainNav = document.querySelector('.main-nav');
    const dropdowns = document.querySelectorAll('.dropdown');

    if (menuToggle && navClose && mainNav) {
        menuToggle.addEventListener('click', () => {
            mainNav.classList.add('active');
        });

        navClose.addEventListener('click', () => {
            mainNav.classList.remove('active');
        });

        dropdowns.forEach(dropdown => {
            const toggle = dropdown.querySelector('.dropdown-toggle');
            if (toggle) {
                toggle.addEventListener('click', (e) => {
                    e.preventDefault();
                    dropdown.classList.toggle('active');
                });
            }
        });

        document.addEventListener('click', (e) => {
            if (!mainNav.contains(e.target) && !menuToggle.contains(e.target)) {
                mainNav.classList.remove('active');
            }
        });
    }
}

function checkAuth() {
    const loggedInUserId = sessionStorage.getItem('loggedInUserId');
    if (!loggedInUserId) {
        window.location.href = 'index.html';
        return;
    }

    const docRef = doc(db, "users", loggedInUserId);
    
    unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            const userData = docSnap.data();
            document.getElementById('loggedUserFName').innerText = userData.firstName || '';
            document.getElementById('loggedUserLName').innerText = userData.lastName || '';
        } else {
            console.log("No document found matching id");
            sessionStorage.removeItem('loggedInUserId');
            window.location.href = 'index.html';
        }
    });
    
    setupUnreadMessagesListener(loggedInUserId);
}

function setupUnreadMessagesListener(userId) {
    // Listen for changes to the chat metadata for this user
    const chatMetadataRef = doc(db, "chatMetadata", userId);
    
    chatMetadataUnsubscribe = onSnapshot(chatMetadataRef, (doc) => {
        if (doc.exists()) {
            const metadata = doc.data();
            const unreadCount = metadata.userUnreadCount || 0;
            
            const unreadBadge = document.getElementById('unreadMessageCount');
            const floatingHelpBtn = document.querySelector('.floating-help-btn');
            
            if (unreadBadge && floatingHelpBtn) {
                unreadBadge.textContent = unreadCount;
                // Only show the help button if there are unread messages from admin
                if (unreadCount > 0 && metadata.lastMessage && metadata.lastMessage.sender === 'admin') {
                    floatingHelpBtn.style.display = 'flex';
                    unreadBadge.style.display = 'block';
                } else {
                    floatingHelpBtn.style.display = 'none';
                    unreadBadge.style.display = 'none';
                }
                console.log("User unread count:", unreadCount);
            } else {
                console.error("Floating help button elements not found");
            }
        } else {
            console.log("No chat metadata found for user");
        }
    });
}

function setupHeaderScroll() {
    let lastScroll = 0;
    const header = document.getElementById('main-header');

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;

        if (currentScroll <= 0) {
            header.classList.remove('hidden');
            return;
        }

        if (currentScroll > lastScroll && !header.classList.contains('hidden')) {
            header.classList.add('hidden');
        } else if (currentScroll < lastScroll && header.classList.contains('hidden')) {
            header.classList.remove('hidden');
        }

        lastScroll = currentScroll;
    });
}

// Setup logout button event listener
document.addEventListener('DOMContentLoaded', () => {
    const logoutButton = document.getElementById('logout');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            if (unsubscribe) {
                unsubscribe();
            }
            if (chatMetadataUnsubscribe) {
                chatMetadataUnsubscribe();
            }
            sessionStorage.removeItem('loggedInUserId');
            signOut(auth)
                .then(() => {
                    window.location.href = 'index.html';
                })
                .catch((error) => {
                    console.error('Error signing out:', error);
                });
        });
    }
});

// Cleanup on page unload
window.addEventListener('unload', () => {
    if (unsubscribe) {
        unsubscribe();
    }
    if (chatMetadataUnsubscribe) {
        chatMetadataUnsubscribe();
    }
});
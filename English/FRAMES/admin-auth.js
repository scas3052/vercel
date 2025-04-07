import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD; // This is just for verification, actual auth is handled by Firebase

function showMessage(message, isSuccess = false) {
    const messageDiv = document.getElementById('adminLoginMessage');
    messageDiv.style.display = "block";
    messageDiv.innerHTML = message;
    messageDiv.style.opacity = 1;
    messageDiv.style.backgroundColor = isSuccess ? 'var(--auth-success)' : 'var(--auth-error)';
    
    setTimeout(() => {
        messageDiv.style.opacity = 0;
    }, 5000);
}

document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;

    if (email !== ADMIN_EMAIL) {
        showMessage('Access denied. Invalid admin credentials.');
        return;
    }

    // Verify password matches before attempting Firebase auth
    if (password !== ADMIN_PASSWORD) {
        showMessage('Access denied. Invalid admin credentials.');
        return;
    }

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        showMessage('Login successful', true);
        sessionStorage.setItem('adminLoggedIn', 'true');
        setTimeout(() => {
            window.location.href = 'admin-dashboard.html';
        }, 1000);
    } catch (error) {
        let errorMessage = 'Login failed. Please try again.';
        
        switch(error.code) {
            case 'auth/invalid-email':
                errorMessage = 'Please enter a valid email address.';
                break;
            case 'auth/user-not-found':
            case 'auth/wrong-password':
                errorMessage = 'Invalid admin credentials.';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Too many failed attempts. Please try again later.';
                break;
        }
        
        showMessage(errorMessage);
    }
});
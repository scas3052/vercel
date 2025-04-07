import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDqfO7C2jAeFCeggWoDDwnP6Mi0KQF4xCE",
    authDomain: "haftrail.firebaseapp.com",
    projectId: "haftrail",
    storageBucket: "haftrail.firebasestorage.app",
    messagingSenderId: "308714739048",
    appId: "1:308714739048:web:ec3732457c4fac96f372dd"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
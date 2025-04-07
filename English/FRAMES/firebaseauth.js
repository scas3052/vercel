import { auth, db } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  deleteUser,
} from 'https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js';
import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
} from 'https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js';

function showMessage(message, divId, isSuccess = false) {
  var messageDiv = document.getElementById(divId);
  messageDiv.style.display = 'block';
  messageDiv.innerHTML = message;
  messageDiv.style.opacity = 1;
  messageDiv.style.backgroundColor = isSuccess
    ? 'var(--auth-success)'
    : 'var(--auth-error)';
  setTimeout(function () {
    messageDiv.style.opacity = 0;
  }, 5000);
}

// Email/Password Sign Up
document.addEventListener('DOMContentLoaded', () => {
  const signUp = document.getElementById('submitSignUp');
  if (signUp) {
    signUp.addEventListener('click', async (event) => {
      event.preventDefault();
      console.log('Sign up button clicked');

      const email = document.getElementById('rEmail').value;
      const password = document.getElementById('rPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      const firstName = document.getElementById('fName').value;
      const lastName = document.getElementById('lName').value;
      const mobileNumber = document.getElementById('mobileNumber').value;
      const acceptTerms = document.getElementById('acceptTerms').checked;

      // Form validation
      if (
        !email ||
        !password ||
        !confirmPassword ||
        !firstName ||
        !lastName ||
        !mobileNumber
      ) {
        showMessage('Please fill in all fields', 'signUpMessage');
        return;
      }

      if (password !== confirmPassword) {
        showMessage('Passwords do not match', 'signUpMessage');
        return;
      }

      if (!acceptTerms) {
        showMessage(
          'Please accept the Terms & Conditions to continue',
          'signUpMessage'
        );
        return;
      }

      if (!/^\d{10}$/.test(mobileNumber)) {
        showMessage(
          'Please enter a valid 10-digit mobile number',
          'signUpMessage'
        );
        return;
      }

      try {
        console.log('Creating user account...');
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        const user = userCredential.user;
        const userId = user.uid;

        // Store user data in Firestore
        const userData = {
          email: email,
          firstName: firstName,
          lastName: lastName,
          phone: mobileNumber,
          createdAt: new Date().toISOString(),
        };
        await setDoc(doc(db, 'users', userId), userData);
        console.log('User data stored in Firestore with UID:', userId);

        showMessage('Account created successfully!', 'signUpMessage', true);

        // Redirect to homepage after successful signup
        setTimeout(() => {
          sessionStorage.setItem('loggedInUserId', userId);
          window.location.href = 'homepage.html';
        }, 1500);
      } catch (error) {
        console.error('Signup error:', error);
        let errorMessage;
        switch (error.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'Email Address Already Exists';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Please enter a valid email address';
            break;
          case 'auth/weak-password':
            errorMessage = 'Password should be at least 6 characters';
            break;
          default:
            errorMessage = 'Unable to create account. Please try again.';
        }
        showMessage(errorMessage, 'signUpMessage');
      }
    });
  }

  // Email/Password Sign In
  const signIn = document.getElementById('submitSignIn');
  if (signIn) {
    signIn.addEventListener('click', (event) => {
      event.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;

      if (!email || !password) {
        showMessage('Please enter both email and password', 'signInMessage');
        return;
      }

      signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
          const user = userCredential.user;
          showMessage('Login successful', 'signInMessage', true);
          setTimeout(() => {
            sessionStorage.setItem('loggedInUserId', user.uid);
            window.location.href = 'homepage.html';
          }, 1000);
        })
        .catch((error) => {
          const errorCode = error.code;
          let errorMessage;

          switch (errorCode) {
            case 'auth/invalid-email':
              errorMessage = 'Please enter a valid email address';
              break;
            case 'auth/user-disabled':
              errorMessage = 'This account has been disabled';
              break;
            case 'auth/user-not-found':
              errorMessage =
                'No account exists with this email. Please sign up first.';
              break;
            case 'auth/wrong-password':
              errorMessage = 'Incorrect password. Please try again.';
              break;
            case 'auth/invalid-login-credentials':
              errorMessage =
                'No account exists with this email. Please sign up first.';
              break;
            case 'auth/invalid-credential':
              errorMessage =
                'Invalid credentials. Please check your email and password.';
              break;
            case 'auth/missing-password':
              errorMessage = 'Please enter your password';
              break;
            default:
              errorMessage = 'Login failed. Please try again.';
          }

          showMessage(errorMessage, 'signInMessage');
        });
    });
  }

  // Google Authentication
  const googleProvider = new GoogleAuthProvider();

  // Google Sign In
  const googleSignIn = document.getElementById('googleSignIn');
  if (googleSignIn) {
    googleSignIn.addEventListener('click', () => {
      handleGoogleAuth('signInMessage');
    });
  }

  // Google Sign Up
  const googleSignUp = document.getElementById('googleSignUp');
  if (googleSignUp) {
    googleSignUp.addEventListener('click', () => {
      handleGoogleAuth('signUpMessage');
    });
  }

  async function handleGoogleAuth(messageDiv) {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Check if user exists in Firestore
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        // New user - create profile
        const nameParts = user.displayName
          ? user.displayName.split(' ')
          : ['User', ''];
        const userData = {
          email: user.email,
          firstName: nameParts[0],
          lastName: nameParts.slice(1).join(' '),
          photoURL: user.photoURL || null,
          createdAt: new Date().toISOString(),
        };

        await setDoc(userRef, userData);
        showMessage('Account Created Successfully', messageDiv, true);

        sessionStorage.setItem('loggedInUserId', user.uid);
        sessionStorage.setItem('needsMobileNumber', 'true');

        setTimeout(() => {
          window.location.href = 'profile.html';
        }, 1000);
      } else {
        showMessage('Login successful', messageDiv, true);

        setTimeout(() => {
          sessionStorage.setItem('loggedInUserId', user.uid);
          window.location.href = 'homepage.html';
        }, 1000);
      }
    } catch (error) {
      console.error('Google auth error:', error);
      let errorMessage = 'Authentication failed. Please try again.';

      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Sign in was cancelled.';
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage =
          'Pop-up was blocked by your browser. Please allow pop-ups for this site.';
      }

      showMessage(errorMessage, messageDiv);
    }
  }
});
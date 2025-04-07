document.addEventListener('DOMContentLoaded', () => {
  // Check if user is already logged in
  const loggedInUserId = sessionStorage.getItem('loggedInUserId');
  const adminLoggedIn = sessionStorage.getItem('adminLoggedIn');
  
  if (loggedInUserId) {
    window.location.href = 'homepage.html';
    return;
  } else if (adminLoggedIn) {
    window.location.href = 'admin-dashboard.html';
    return;
  }

  const signUpButton = document.getElementById('signUpButton');
  const signInButton = document.getElementById('signInButton');
  const signInForm = document.getElementById('signIn');
  const signUpForm = document.getElementById('signup');

  if (signUpButton) {
    signUpButton.addEventListener('click', function(e) {
      e.preventDefault();
      signInForm.style.display = "none";
      signUpForm.style.display = "block";
      signUpForm.style.animation = 'slideUp 0.5s ease-out';
    });
  }

  if (signInButton) {
    signInButton.addEventListener('click', function(e) {
      e.preventDefault();
      signInForm.style.display = "block";
      signUpForm.style.display = "none";
      signInForm.style.animation = 'slideUp 0.5s ease-out';
    });
  }
});

// Function to toggle password visibility
function togglePasswordVisibility(inputId) {
  const passwordInput = document.getElementById(inputId);
  const toggleButton = passwordInput.nextElementSibling;
  const icon = toggleButton.querySelector('i');
  
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  } else {
    passwordInput.type = 'password';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  }
}
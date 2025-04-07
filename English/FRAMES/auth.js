// Authentication System
(function() {
  // List of public pages that don't require authentication
  const publicPages = ['index.html', 'signup.html', 'forgot-password.html'];
  
  // Function to check if current page is public
  function isPublicPage() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    return publicPages.includes(currentPage);
  }

  // Function to get current page name
  function getCurrentPage() {
    return window.location.pathname.split('/').pop() || 'index.html';
  }

  // Main authentication check function
  function checkAuth() {
    const loggedInUserId = sessionStorage.getItem('loggedInUserId');
    const currentPage = getCurrentPage();

    // Allow access to public pages even without auth
    if (isPublicPage()) {
      // If user is logged in and tries to access login page, redirect to homepage
      if (loggedInUserId) {
        window.location.href = 'homepage.html';
        return false;
      }
      return true;
    }

    // For protected pages, check authentication
    if (!loggedInUserId) {
      // Store the attempted URL to redirect back after login
      sessionStorage.setItem('redirectUrl', window.location.href);
      window.location.href = 'index.html';
      return false;
    }

    return true;
  }

  // Function to handle logout
  function logout() {
    sessionStorage.removeItem('loggedInUserId');
    localStorage.removeItem('cart'); // Clear cart data on logout
    window.location.href = 'index.html';
  }

  // Function to handle login success
  function handleLoginSuccess(userId) {
    sessionStorage.setItem('loggedInUserId', userId);
    window.location.href = 'homepage.html';
  }

  // Attach logout handler to all logout buttons
  document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', logout);
    }

    // Perform authentication check on every page load
    checkAuth();
  });

  // Expose necessary functions to global scope
  window.auth = {
    checkAuth,
    logout,
    handleLoginSuccess
  };
})();
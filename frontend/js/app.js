// Main App
(function() {
  'use strict';

  // Initialize authentication
  Auth.init();

  // Login form handler
  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('login-error');
    const btnText = e.target.querySelector('.btn-text');
    const btnLoading = e.target.querySelector('.btn-loading');

    errorEl.classList.add('hidden');
    btnText.classList.add('hidden');
    btnLoading.classList.remove('hidden');

    try {
      await Auth.login(email, password);
      window.location.hash = '#/dashboard';
    } catch (error) {
      errorEl.textContent = error.message || 'Login failed';
      errorEl.classList.remove('hidden');
    } finally {
      btnText.classList.remove('hidden');
      btnLoading.classList.add('hidden');
    }
  });

  // Logout handler
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    Auth.logout();
    window.location.hash = '#/login';
  });

  // Initialize router
  Router.init();
})();

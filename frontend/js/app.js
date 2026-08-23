// Main App
(async function() {
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

  // First-run check: if no user account exists yet anywhere, send whoever
  // opens the app to the admin-creation screen instead of a login form for
  // an account that can't possibly exist yet. Skipped if they're already
  // logged in, or if they arrived via an invite link (that link only makes
  // sense once an owner already exists, so needs_setup would be false
  // anyway - but checking first avoids a pointless network call clobbering
  // the hash before AcceptInvitePage gets to read its token).
  if (!Auth.isLoggedIn() && !window.location.hash.startsWith('#/accept-invite')) {
    try {
      const response = await Api.get(API.AUTH.SETUP_STATUS);
      if (response.success && response.data.needs_setup) {
        window.location.hash = '#/setup';
      }
    } catch (error) {
      console.error('Setup status check failed:', error);
    }
  }

  // Initialize router
  Router.init();

  // Offline / sync status banner
  async function renderOfflineBanner() {
    const banner = document.getElementById('offline-banner');
    if (!banner) return;

    if (!OfflineSync.isOnline()) {
      const pendingCount = await OfflineStore.getPendingSales().then(s => s.length).catch(() => 0);
      banner.className = 'offline-banner offline';
      banner.innerHTML = `
        <span>⚠️ You're offline. Cash sales still work and will sync automatically once you're back online.${pendingCount ? ` (${pendingCount} queued)` : ''}</span>
      `;
      return;
    }

    if (OfflineSync.syncing) {
      banner.className = 'offline-banner syncing';
      banner.innerHTML = `<span>🔄 Syncing offline sales...</span>`;
      return;
    }

    const pendingCount = await OfflineStore.getPendingSales().then(s => s.length).catch(() => 0);
    if (pendingCount > 0) {
      banner.className = 'offline-banner syncing';
      banner.innerHTML = `
        <span>⏳ ${pendingCount} offline sale${pendingCount > 1 ? 's' : ''} waiting to sync</span>
        <button class="offline-banner-action" onclick="OfflineSync.syncPendingSales()">Sync now</button>
      `;
      return;
    }

    banner.className = 'offline-banner hidden';
    banner.innerHTML = '';
  }

  OfflineSync.onStatusChange(renderOfflineBanner);
  renderOfflineBanner();
  // Pending count can change from actions the status-change event doesn't
  // cover (e.g. a cash sale queued while already offline) - poll lightly as
  // a backstop.
  setInterval(renderOfflineBanner, 10000);
})();

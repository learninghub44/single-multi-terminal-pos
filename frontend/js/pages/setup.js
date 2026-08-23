// First-Run Admin Setup Page
const SetupPage = {
  bound: false,

  render() {
    // Called every time the #/setup route is hit - only attach the submit
    // listener once, but always re-check status so a stale visit (someone
    // bookmarks #/setup after another admin has already completed it)
    // shows a clear message instead of a form that will just 403.
    this.checkStillNeeded();
    if (!this.bound) {
      this.bound = true;
      this.bindForm();
    }
  },

  async checkStillNeeded() {
    try {
      const response = await Api.get(API.AUTH.SETUP_STATUS);
      if (response.success && !response.data.needs_setup) {
        Toast.show('Setup has already been completed - please log in', 'info');
        window.location.hash = '#/login';
      }
    } catch (error) {
      console.error('Setup status check failed:', error);
    }
  },

  bindForm() {
    document.getElementById('setup-form').addEventListener('submit', async (e) => {
      e.preventDefault();

      const full_name = document.getElementById('setup-name').value;
      const email = document.getElementById('setup-email').value;
      const password = document.getElementById('setup-password').value;
      const errorEl = document.getElementById('setup-error');
      const btnText = e.target.querySelector('.btn-text');
      const btnLoading = e.target.querySelector('.btn-loading');

      errorEl.classList.add('hidden');
      btnText.classList.add('hidden');
      btnLoading.classList.remove('hidden');

      try {
        const response = await Api.post(API.AUTH.SETUP, { full_name, email, password });

        if (response.success) {
          if (response.data.session) {
            Auth.setSession(response.data.user, response.data.session);
            Toast.show('Admin account created', 'success');
            window.location.hash = '#/dashboard';
          } else {
            Toast.show('Admin account created - please log in', 'success');
            window.location.hash = '#/login';
          }
        }
      } catch (error) {
        errorEl.textContent = error.message || 'Failed to create admin account';
        errorEl.classList.remove('hidden');
      } finally {
        btnText.classList.remove('hidden');
        btnLoading.classList.add('hidden');
      }
    });
  }
};

window.SetupPage = SetupPage;

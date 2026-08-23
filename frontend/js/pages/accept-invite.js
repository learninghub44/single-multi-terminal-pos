// Accept Staff Invite Page
const AcceptInvitePage = {
  token: null,
  bound: false,

  async render(token) {
    this.token = token;

    const contextEl = document.getElementById('invite-context');
    const formEl = document.getElementById('accept-invite-form');
    const errorEl = document.getElementById('invite-error');

    formEl.classList.add('hidden');
    errorEl.classList.add('hidden');

    if (!token) {
      contextEl.textContent = 'This invite link is missing its code. Ask whoever invited you to resend it.';
      return;
    }

    contextEl.textContent = 'Checking your invite...';

    try {
      const response = await Api.get(API.AUTH.INVITE_INFO(token));

      if (response.success) {
        const { role, email, business_name } = response.data;
        contextEl.textContent = `Join ${business_name} as ${this.roleLabel(role)}`;
        formEl.classList.remove('hidden');

        const emailInput = document.getElementById('invite-email');
        if (email) {
          // Invite was sent to a specific address - lock it so the account
          // that gets created is provably the one the invite was meant for.
          emailInput.value = email;
          emailInput.disabled = true;
        } else {
          emailInput.value = '';
          emailInput.disabled = false;
        }

        if (!this.bound) {
          this.bound = true;
          this.bindForm();
        }
      }
    } catch (error) {
      contextEl.textContent = error.message || 'This invite link is not valid.';
    }
  },

  roleLabel(role) {
    return { owner: 'an Owner', manager: 'a Manager', cashier: 'a Cashier' }[role] || role;
  },

  bindForm() {
    document.getElementById('accept-invite-form').addEventListener('submit', async (e) => {
      e.preventDefault();

      const full_name = document.getElementById('invite-name').value;
      const email = document.getElementById('invite-email').value;
      const password = document.getElementById('invite-password').value;
      const errorEl = document.getElementById('invite-error');
      const btnText = e.target.querySelector('.btn-text');
      const btnLoading = e.target.querySelector('.btn-loading');

      errorEl.classList.add('hidden');
      btnText.classList.add('hidden');
      btnLoading.classList.remove('hidden');

      try {
        const response = await Api.post(API.AUTH.ACCEPT_INVITE, {
          token: this.token,
          email,
          password,
          full_name
        });

        if (response.success) {
          if (response.data.session) {
            Auth.setSession(response.data.user, response.data.session);
            Toast.show('Account created - welcome!', 'success');
            window.location.hash = '#/dashboard';
          } else {
            Toast.show('Account created - please log in', 'success');
            window.location.hash = '#/login';
          }
        }
      } catch (error) {
        errorEl.textContent = error.message || 'Failed to create account';
        errorEl.classList.remove('hidden');
      } finally {
        btnText.classList.remove('hidden');
        btnLoading.classList.add('hidden');
      }
    });
  }
};

window.AcceptInvitePage = AcceptInvitePage;

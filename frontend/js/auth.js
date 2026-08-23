// Authentication
const Auth = {
  user: null,
  session: null,
  terminal: null,

  init() {
    const user = localStorage.getItem('pos_user');
    const session = localStorage.getItem('pos_session');
    const terminal = localStorage.getItem('pos_terminal');

    if (user && session) {
      this.user = JSON.parse(user);
      this.session = JSON.parse(session);
    }

    if (terminal) {
      this.terminal = JSON.parse(terminal);
    }
  },

  getToken() {
    return this.session?.access_token || null;
  },

  isLoggedIn() {
    return !!this.user && !!this.session;
  },

  hasPermission(page) {
    if (!this.user) return false;
    return PERMISSIONS[this.user.role]?.includes(page) || false;
  },

  async login(email, password) {
    const response = await Api.post(API.AUTH.LOGIN, { email, password });

    if (response.success) {
      this.user = response.data.user;
      this.session = response.data.session;

      localStorage.setItem('pos_user', JSON.stringify(this.user));
      localStorage.setItem('pos_session', JSON.stringify(this.session));

      return true;
    }

    throw new Error(response.error?.message || 'Login failed');
  },

  // Used by setup/accept-invite flows, which create + sign in a user via
  // their own dedicated endpoints rather than /auth/login - same storage
  // side effect as login(), factored out so both places don't duplicate it.
  setSession(user, session) {
    this.user = user;
    this.session = session;
    localStorage.setItem('pos_user', JSON.stringify(user));
    localStorage.setItem('pos_session', JSON.stringify(session));
  },

  logout() {
    this.user = null;
    this.session = null;

    localStorage.removeItem('pos_user');
    localStorage.removeItem('pos_session');
  },

  updateUser(userData) {
    this.user = { ...this.user, ...userData };
    localStorage.setItem('pos_user', JSON.stringify(this.user));
  },

  setTerminal(terminal) {
    this.terminal = terminal;
    localStorage.setItem('pos_terminal', JSON.stringify(terminal));
  },

  getTerminal() {
    return this.terminal;
  },

  getTerminalId() {
    return this.terminal?.id || null;
  },

  clearTerminal() {
    this.terminal = null;
    localStorage.removeItem('pos_terminal');
  }
};

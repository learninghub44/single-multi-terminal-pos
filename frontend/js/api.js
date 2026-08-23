// API Client
const Api = {
  async request(url, options = {}) {
    const token = Auth.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        // The server returned something that isn't JSON at all - almost
        // always means it crashed before reaching our own error handling
        // (a raw platform error page, an empty body, a network proxy
        // interstitial). The raw SyntaxError ("Unexpected token '<'...")
        // is meaningless to someone using the app, so replace it with a
        // message that actually says what to do next.
        throw new Error(
          response.ok
            ? "Got an unexpected response from the server. Try again in a moment."
            : `Server error (HTTP ${response.status}). If this keeps happening, check the Worker's Logs in the Cloudflare dashboard for the real cause.`
        );
      }

      if (!response.ok) {
        throw new Error(data.error?.message || 'Request failed');
      }

      return data;
    } catch (error) {
      if (error.message === 'Invalid or expired token') {
        Auth.logout();
        window.location.hash = '#/login';
      }
      throw error;
    }
  },

  get(url, params = {}) {
    const searchParams = new URLSearchParams(params);
    const fullUrl = searchParams.toString() ? `${url}?${searchParams}` : url;
    return this.request(fullUrl);
  },

  post(url, body) {
    return this.request(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  put(url, body) {
    return this.request(url, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },

  delete(url) {
    return this.request(url, {
      method: 'DELETE'
    });
  }
};

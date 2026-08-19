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

      const data = await response.json();

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

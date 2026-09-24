import { apiRequest } from "./api";

/**
 * Authentication service communicating with backend auth routes
 */
export const authService = {
  /**
   * Register a new user
   * @param {{ name: string, email: string, password: string }} userData
   */
  async register(userData) {
    return await apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  },

  /**
   * Log in an existing user
   * @param {{ email: string, password: string }} credentials
   */
  async login(credentials) {
    const data = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });

    if (data.token) {
      localStorage.setItem("token", data.token);
      // Attempt to decode user payload from JWT token
      try {
        const payloadBase64 = data.token.split(".")[1];
        const payload = JSON.parse(atob(payloadBase64));
        const userObj = {
          id: payload.userId,
          role: payload.role,
          email: credentials.email,
        };
        localStorage.setItem("user", JSON.stringify(userObj));
        data.user = userObj;
      } catch (err) {
        console.warn("Could not decode JWT payload:", err);
      }
    }

    return data;
  },

  /**
   * Log out user and clear stored authentication data
   */
  logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  },

  /**
   * Retrieve current stored token
   */
  getToken() {
    return localStorage.getItem("token");
  },

  /**
   * Retrieve current stored user profile
   */
  getCurrentUser() {
    try {
      const userStr = localStorage.getItem("user");
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  },
};

export default authService;

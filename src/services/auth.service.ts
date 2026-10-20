import { apiRequest } from "@/services/api-client";
import { API_BASE_URL } from "@/config/api";

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
};

export type GoogleOidcCallback = {
  code: string;
  state: string;
};

export type AuthUser = {
  userId: string;
  role: string | null;
  status: string;
  email: string;
  fullName: string;
  roles: string[];
};

export const authService = {
  googleOidcStartUrl() {
    return `${API_BASE_URL}/auth/oidc/google/mobile`;
  },

  exchangeGoogleOidcCode(query: GoogleOidcCallback) {
    const search = new URLSearchParams({ code: query.code, state: query.state });
    return apiRequest<AuthTokens>(`/auth/oidc/google/callback?${search.toString()}`);
  },

  login(email: string, password: string) {
    return apiRequest<AuthTokens>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
  },

  refresh(refreshToken: string) {
    return apiRequest<AuthTokens>("/auth/refresh", {
      method: "POST",
      body: { refreshToken },
    });
  },

  getMe(token: string) {
    return apiRequest<AuthUser>("/auth/me", { token });
  },

  logout(refreshToken: string) {
    return apiRequest<void>("/auth/logout", {
      method: "POST",
      body: { refreshToken },
    });
  },

  changePassword(token: string, currentPassword: string, newPassword: string) {
    return apiRequest<void>("/auth/change-password", {
      method: "POST",
      token,
      body: { currentPassword, newPassword },
    });
  },
};

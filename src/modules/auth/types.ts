export interface AuthUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken?: string; // server may still include it; client ignores it — stored as httpOnly cookie
}

export interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  // refreshToken is intentionally absent: it lives in an httpOnly cookie (not JS-accessible)
}

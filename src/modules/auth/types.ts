export interface AuthUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken?: string; 
}

export interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  
}

export interface AuthUser {
  id: number;
  email: string;
  role: string;
  scope: string;
  merchant: { id: number };
  planId?: number;
  authorizedFeatureIds: number[];
}

export interface LoginResponse {
  access_token: string;
  refreshToken: string;
  user: AuthUser;
}

export interface MessageResponse {
  message: string;
}

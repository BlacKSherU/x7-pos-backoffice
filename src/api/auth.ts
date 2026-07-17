import { INVALID_CREDENTIALS_MESSAGE } from '../lib/api-error';
import type { LoginResponse, MessageResponse } from '../types/auth';
import { postJson as postJsonRequest } from './http';

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const fallback =
    path === '/auth/login'
      ? INVALID_CREDENTIALS_MESSAGE
      : 'Request failed. Please try again.';
  return postJsonRequest<T>(path, body, fallback);
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return postJson<LoginResponse>('/auth/login', { email, password });
}

export function requestPasswordReset(email: string): Promise<MessageResponse> {
  return postJson<MessageResponse>('/auth/forgot-password', { email });
}

export function resetPassword(
  token: string,
  newPassword: string,
): Promise<MessageResponse> {
  return postJson<MessageResponse>('/auth/reset-password', {
    token,
    newPassword,
  });
}

import { apiFetch } from './client';
import type { AuthResponse } from '../types';

export function register(name: string, email: string, password: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function refreshToken(refresh_token: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token }),
  });
}

export function logout(refresh_token: string): Promise<void> {
  return apiFetch<void>('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refresh_token }),
  });
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SessionInfo {
  id: string;
  deviceName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error: any = new Error(data.error?.message || 'An unexpected error occurred.');
    error.code = data.error?.code || 'UNKNOWN_ERROR';
    error.statusCode = res.status;
    throw error;
  }
  return data as T;
}

export const api = {
  async register(body: { email: string; password: string; name?: string }): Promise<{ user: User }> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    return handleResponse<{ user: User }>(res);
  },

  async login(body: { email: string; password: string }): Promise<{ user: User }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    return handleResponse<{ user: User }>(res);
  },

  async logout(): Promise<void> {
    const res = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    await handleResponse(res);
  },

  async getMe(): Promise<{ user: User }> {
    const res = await fetch('/api/auth/me', {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<{ user: User }>(res);
  },

  async getSessions(): Promise<{ sessions: SessionInfo[] }> {
    const res = await fetch('/api/auth/sessions', {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<{ sessions: SessionInfo[] }>(res);
  },

  async revokeSession(sessionId: string): Promise<void> {
    const res = await fetch(`/api/auth/sessions/${sessionId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    await handleResponse(res);
  },

  async revokeAllSessions(): Promise<void> {
    const res = await fetch('/api/auth/sessions', {
      method: 'DELETE',
      credentials: 'include',
    });
    await handleResponse(res);
  },

  async requestEmailVerification(): Promise<{ message: string }> {
    const res = await fetch('/api/auth/verify-email/request', {
      method: 'POST',
      credentials: 'include',
    });
    return handleResponse<{ message: string }>(res);
  },

  async confirmEmailVerification(token: string): Promise<{ user: User; message: string }> {
    const res = await fetch('/api/auth/verify-email/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return handleResponse<{ user: User; message: string }>(res);
  },

  async forgotPassword(email: string): Promise<{ message: string }> {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return handleResponse<{ message: string }>(res);
  },

  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    return handleResponse<{ message: string }>(res);
  },
};

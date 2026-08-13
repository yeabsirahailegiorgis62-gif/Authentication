import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: (import.meta as any).env?.VITE_SERVER_URL || 'http://localhost:4000',
});

export const { useSession, signIn, signUp, signOut } = authClient;

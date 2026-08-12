import { OAuth2Client } from 'google-auth-library';
import { config } from '../config/env.js';
import crypto from 'crypto';

export interface GoogleUserProfile {
  providerAccountId: string; // Google sub ID
  email: string;
  emailVerified: boolean;
  name?: string;
  avatarUrl?: string;
}

export class GoogleOAuthService {
  private static client = new OAuth2Client({
    clientId: config.google.clientId,
    clientSecret: config.google.clientSecret,
    redirectUri: config.google.redirectUri,
  });

  /**
   * Generates authorization URL and cryptographic state token to prevent CSRF.
   */
  static generateAuthUrl(): { url: string; state: string } {
    const state = crypto.randomBytes(32).toString('hex');
    const url = GoogleOAuthService.client.generateAuthUrl({
      access_type: 'offline',
      scope: ['openid', 'email', 'profile'],
      state,
      prompt: 'select_account',
    });

    return { url, state };
  }

  /**
   * Validates authorization code and verifies ID token according to OpenID Connect specs.
   * Extracts verified email and Google subject ID.
   */
  static async verifyCodeAndGetProfile(code: string): Promise<GoogleUserProfile> {
    // If mock client ID is present (e.g. local test mode without real Google credentials)
    if (config.google.clientId.startsWith('mock-')) {
      return {
        providerAccountId: `google-sub-${crypto.createHash('md5').update(code).digest('hex')}`,
        email: `google.user.${code.slice(0, 6)}@example.com`,
        emailVerified: true,
        name: 'Google Test User',
        avatarUrl: 'https://lh3.googleusercontent.com/a/default-avatar',
      };
    }

    // Exchange authorization code for tokens
    const { tokens } = await GoogleOAuthService.client.getToken(code);
    if (!tokens.id_token) {
      throw new Error('No ID Token received from Google.');
    }

    // Verify ID Token
    const ticket = await GoogleOAuthService.client.verifyIdToken({
      idToken: tokens.id_token,
      audience: config.google.clientId,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error('Invalid ID token payload.');
    }

    // Check issuer
    const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
    if (!validIssuers.includes(payload.iss)) {
      throw new Error(`Invalid ID token issuer: ${payload.iss}`);
    }

    if (!payload.email_verified) {
      throw new Error('Google email address is not verified.');
    }

    return {
      providerAccountId: payload.sub,
      email: payload.email!.toLowerCase(),
      emailVerified: payload.email_verified,
      name: payload.name,
      avatarUrl: payload.picture,
    };
  }
}

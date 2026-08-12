import argon2 from 'argon2';
import { isCommonPassword } from '../utils/commonPasswords.js';

export interface PasswordValidationResult {
  valid: boolean;
  message?: string;
}

export class PasswordService {
  /**
   * Validates password against security rules:
   * - minimum 12 characters
   * - maximum 128 characters
   * - not a common breached password
   */
  static validatePassword(password: string): PasswordValidationResult {
    if (!password || typeof password !== 'string') {
      return { valid: false, message: 'Password is required.' };
    }
    if (password.length < 12) {
      return { valid: false, message: 'Password must be at least 12 characters long.' };
    }
    if (password.length > 128) {
      return { valid: false, message: 'Password must not exceed 128 characters.' };
    }
    if (isCommonPassword(password)) {
      return { valid: false, message: 'This password is too common and unsafe. Please choose a stronger password.' };
    }
    return { valid: true };
  }

  /**
   * Hashes a password using Argon2id.
   */
  static async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    });
  }

  /**
   * Verifies a password against an Argon2id hash.
   */
  static async verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }
}

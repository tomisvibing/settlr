import { describe, it, expect } from 'vitest';
import { normalizeEmail, looksLikeEmail, cleanCode, nameFromEmail, friendlyAuthError } from '../src/lib/signin.js';

describe('email sign-in helpers', () => {
  it('normalises and checks emails', () => {
    expect(normalizeEmail('  Tom@Example.COM ')).toBe('tom@example.com');
    expect(looksLikeEmail('tom@example.com')).toBe(true);
    expect(looksLikeEmail('tom@example')).toBe(false);
    expect(looksLikeEmail('tom example.com')).toBe(false);
    expect(looksLikeEmail('')).toBe(false);
  });
  it('keeps only the digits of a pasted code', () => {
    expect(cleanCode(' 123 456 ')).toBe('123456');
    expect(cleanCode('12-34-56')).toBe('123456');
    expect(cleanCode('123456789012')).toBe('1234567890');
  });
  it('guesses a readable name from the email', () => {
    expect(nameFromEmail('tom.smith@example.com')).toBe('Tom Smith');
    expect(nameFromEmail('priya_k+settlr@example.com')).toBe('Priya K');
    expect(nameFromEmail('j-o@example.com')).toBe('J O');
    expect(nameFromEmail('12345@example.com')).toBe('Me');
    expect(nameFromEmail('')).toBe('Me');
  });
  it('turns Supabase auth errors into something actionable', () => {
    expect(friendlyAuthError({ status: 429, message: 'email rate limit exceeded' })).toMatch(/Wait a minute/);
    expect(friendlyAuthError({ message: 'For security purposes, you can only request this after 30 seconds.' })).toMatch(/Wait a minute/);
    expect(friendlyAuthError({ message: 'Token has expired or is invalid' })).toMatch(/code didn’t work/);
    expect(friendlyAuthError({ message: 'Signups not allowed for otp' })).toMatch(/isn’t switched on/);
    expect(friendlyAuthError({ message: 'Failed to fetch' })).toMatch(/connection/);
  });
});

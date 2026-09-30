import { describe, it, expect } from 'vitest';
import { safeAvatarUrl, accountPhoto } from '../src/lib/avatar.js';

describe('profile photos', () => {
  it('accepts Google photo addresses', () => {
    const u = 'https://lh3.googleusercontent.com/a/ACg8ocK=s96-c';
    expect(safeAvatarUrl(u)).toBe(u);
  });
  it('rejects anything else', () => {
    for(const u of ['http://lh3.googleusercontent.com/a/x', 'https://evil.example/googleusercontent.com/a', 'https://lh3.googleusercontent.com.evil.example/a', 'javascript:alert(1)', '', null, undefined, 42, 'https://lh3.googleusercontent.com/' + 'x'.repeat(2100)])
      expect(safeAvatarUrl(u)).toBe(null);
  });
  it('reads the account photo from Google sign-in details', () => {
    expect(accountPhoto({ user_metadata: { picture: 'https://lh3.googleusercontent.com/a/p' } })).toBe('https://lh3.googleusercontent.com/a/p');
    expect(accountPhoto({ user_metadata: { avatar_url: 'https://lh3.googleusercontent.com/a/q', picture: 'https://lh3.googleusercontent.com/a/p' } })).toBe('https://lh3.googleusercontent.com/a/q');
    expect(accountPhoto({ user_metadata: {} })).toBe(null);
    expect(accountPhoto(null)).toBe(null);
  });
});

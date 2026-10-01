import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { SHARED } from '../scripts/sync-function-libs.mjs';

describe('the push function', () => {
  it.each(SHARED)('has the same %s as the app (npm run sync-functions)', f => {
    expect(readFileSync(`supabase/functions/push/lib/${f}`, 'utf8')).toBe(readFileSync(`src/lib/${f}`, 'utf8'));
  });
});

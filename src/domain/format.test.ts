import { describe, expect, it } from 'vitest';
import { formatAppName } from './format';

describe('formatAppName', () => {
  it('returns the product name', () => {
    expect(formatAppName()).toBe('WorkTrack');
  });
});

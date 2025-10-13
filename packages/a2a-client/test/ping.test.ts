import { describe, it, expect } from 'vitest';
import { ping } from '../src/index';

describe('a2a-client ping', () => {
  it('returns a2a:pong', () => {
    expect(ping()).toBe('a2a:pong');
  });
});

import { describe, it, expect } from 'vitest';
import { ping } from '../src/index';

describe('kn0w1-client ping', () => {
  it('returns kn0w1:pong', () => {
    expect(ping()).toBe('kn0w1:pong');
  });
});

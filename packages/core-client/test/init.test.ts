import { describe, it, expect } from 'vitest';
import { initAgentiqClient } from '../src/index';

describe('core-client initAgentiqClient', () => {
  it('throws when missing env and no opts provided', () => {
    // ensure envs are not set in this process
    const origUrl = process.env.VITE_SUPABASE_URL;
    const origKey = process.env.VITE_SUPABASE_ANON_KEY;
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.VITE_SUPABASE_ANON_KEY;

    try {
      expect(() => initAgentiqClient()).toThrowError();
    } finally {
      if (origUrl) process.env.VITE_SUPABASE_URL = origUrl;
      if (origKey) process.env.VITE_SUPABASE_ANON_KEY = origKey;
    }
  });

  it('initializes with explicit options', async () => {
    const client = initAgentiqClient({
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'public-anon-key',
    });
    expect(client).toBeTruthy();
    expect(typeof client.ensureIamUser).toBe('function');
  });
});

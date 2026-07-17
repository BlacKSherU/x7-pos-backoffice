import { describe, expect, it, vi, afterEach } from 'vitest';
import { postJson } from './http';

describe('http client', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts 201 responses with an empty body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        text: async () => '',
      }),
    );

    await expect(postJson('/onboarding/business-profile', {})).resolves.toBeUndefined();
  });
});

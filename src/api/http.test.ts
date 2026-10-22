import { describe, expect, it, vi, afterEach } from 'vitest';
import { apiRequest, postJson } from './http';

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

  it('sends JSON bodies with a JSON content type', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/things', { method: 'POST', body: JSON.stringify({ a: 1 }) }, 'failed');

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('lets the browser set the multipart boundary for FormData bodies', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/upload', { method: 'POST', body: new FormData() }, 'failed');

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined();
  });
});

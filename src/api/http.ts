import { ApiError, getApiErrorMessage } from '../lib/api-error';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';
const REQUEST_TIMEOUT_MS = 30_000;

async function requestJson<T>(
  path: string,
  init: RequestInit,
  fallbackMessage: string,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError('Request timed out. Please try again.', 408);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const message = await getApiErrorMessage(response, fallbackMessage);
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text.trim()) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

export function getJson<T>(
  path: string,
  fallbackMessage = 'Request failed. Please try again.',
): Promise<T> {
  return requestJson<T>(
    path,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
    },
    fallbackMessage,
  );
}

export function postJson<T>(
  path: string,
  body: unknown,
  fallbackMessage = 'Request failed. Please try again.',
): Promise<T> {
  return requestJson<T>(
    path,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    fallbackMessage,
  );
}

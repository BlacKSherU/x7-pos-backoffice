import { ApiError, getApiErrorDetails, getApiErrorMessage } from '../lib/api-error';
import { getAccessToken, redirectToLogin } from '../lib/auth-storage';

export const API_BASE = import.meta.env.VITE_API_URL ?? '/api';
const REQUEST_TIMEOUT_MS = 30_000;

// Cuerpo vacío (201/204 sin contenido) → undefined; si no, JSON.
async function parseJsonBody<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text.trim()) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

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

  return parseJsonBody<T>(response);
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

/** Cabeceras de una petición autenticada (Bearer del usuario en sesión). */
export function authHeaders(includeJson = false): Record<string, string> {
  const token = getAccessToken();
  return {
    Accept: 'application/json',
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Petición autenticada contra la API del backoffice.
 *
 * - Añade el token y `Content-Type: application/json` cuando hay cuerpo.
 * - 401 → cierra la sesión y lleva al login (sesión caducada o token inválido).
 * - Otros errores → `ApiError` con el mensaje y el `code` que mande el backend.
 *
 * No usar para login/registro: ahí un 401 significa credenciales incorrectas.
 */
export async function apiRequest<T>(
  path: string,
  init: RequestInit,
  fallbackMessage: string,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...authHeaders(Boolean(init.body)),
      ...init.headers,
    },
  });

  if (response.status === 401) {
    redirectToLogin();
    throw new ApiError('Unauthorized', 401);
  }

  if (!response.ok) {
    const { message, code } = await getApiErrorDetails(response, fallbackMessage);
    throw new ApiError(message, response.status, code);
  }

  return parseJsonBody<T>(response);
}

/** Lista que el backend devuelve unas veces tal cual y otras envuelta en `{ data }`. */
export type MaybeEnvelopedList<T> = T[] | { data?: T[] };

/** Registro que el backend devuelve unas veces tal cual y otras envuelto en `{ data }`. */
export type MaybeEnvelopedItem<T> = T | { data?: T };

export function unwrapList<T>(json: MaybeEnvelopedList<T> | null | undefined): T[] {
  if (Array.isArray(json)) return json;
  return json?.data ?? [];
}

export function unwrapItem<T>(json: MaybeEnvelopedItem<T>): T {
  return (json as { data?: T }).data || (json as T);
}

export class ApiError extends Error {
  readonly status: number;
  /** Machine code of the error body (`code`), when the backend sends it. */
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function getApiErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  return (await getApiErrorDetails(response, fallback)).message;
}

/**
 * Message and error body code in ONE read (the body of a Response can only be
 * can consume once). The code distinguishes errors with the same status: a 409 capacity
 * that supports manager override is not a 409 busy table.
 */
export async function getApiErrorDetails(
  response: Response,
  fallback: string,
): Promise<{ message: string; code?: string; details?: unknown }> {
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return { message: fallback };
  }
  const code =
    typeof data === 'object' && data !== null && typeof (data as { code?: unknown }).code === 'string'
      ? (data as { code: string }).code
      : undefined;
  const details =
    typeof data === 'object' && data !== null && 'details' in data
      ? (data as { details: unknown }).details
      : undefined;
  return { message: messageFromBody(data) ?? fallback, code, details };
}

function messageFromBody(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const body = data as { message?: unknown; errors?: unknown };

  if (Array.isArray(body.errors) && body.errors.length > 0) {
    return body.errors.filter((item): item is string => typeof item === 'string').join(', ');
  }

  if (Array.isArray(body.message)) return body.message.join(', ');
  if (typeof body.message === 'string') return body.message;
  return null;
}

export const INVALID_CREDENTIALS_MESSAGE =
  'Incorrect email or password. Please try again.';

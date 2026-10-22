/**
 * Respuesta HTTP real para mockear `fetch` en tests. Usar en lugar de objetos parciales
 * (`{ ok, json }`): el cliente de api/http lee el cuerpo con `text()` y mira `status`.
 */
export function jsonResponse(body: unknown, status = 200): Response {
  const noBody = status === 204 || status === 304;
  return new Response(noBody ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

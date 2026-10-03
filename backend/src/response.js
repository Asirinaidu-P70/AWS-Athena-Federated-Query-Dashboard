/**
 * Standard API Gateway HTTP response formatter with CORS headers.
 */
export const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  "Cache-Control": "no-store, no-cache, must-revalidate"
};

/**
 * Returns a success JSON response.
 * @param {any} body 
 * @param {number} statusCode 
 */
export function successResponse(body, statusCode = 200) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body)
  };
}

/**
 * Returns a structured error JSON response.
 * @param {string} message 
 * @param {number} statusCode 
 * @param {string|null} details 
 */
export function errorResponse(message, statusCode = 500, details = null) {
  const payload = {
    error: message,
    statusCode
  };
  if (details && process.env.NODE_ENV !== "production") {
    payload.details = details;
  }
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(payload)
  };
}

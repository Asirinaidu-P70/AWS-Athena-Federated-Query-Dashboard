import { executeAthenaQuery } from "./athena.js";
import {
  getSummaryQuery,
  getCustomersQuery,
  getCitySalesQuery,
  getDateSalesQuery
} from "./queries.js";
import { successResponse, errorResponse } from "./response.js";

/**
 * Extracts HTTP path and method from either API Gateway HTTP API (v2) or REST API (v1) events.
 */
function extractRequestDetails(event) {
  const method =
    event.requestContext?.http?.method ||
    event.httpMethod ||
    "GET";

  const rawPath =
    event.rawPath ||
    event.requestContext?.http?.path ||
    event.path ||
    "/";

  // Normalize path (remove stage prefix if present and trailing slash)
  const normalizedPath = rawPath.replace(/^\/(?:prod|dev|staging)/, "").replace(/\/$/, "") || "/";

  return { method: method.toUpperCase(), path: normalizedPath };
}

/**
 * Main Lambda Handler for Retail Athena Query API.
 */
export async function handler(event, context) {
  console.log("[Lambda Handler] Received event:", JSON.stringify(event, null, 2));

  const { method, path } = extractRequestDetails(event);

  // Handle CORS preflight
  if (method === "OPTIONS") {
    return successResponse({ message: "CORS preflight OK" }, 200);
  }

  try {
    switch (path) {
      case "/health":
      case "/api/health":
        return successResponse({
          status: "ok",
          service: "retail-athena-query-api"
        });

      case "/summary":
      case "/api/summary": {
        const query = getSummaryQuery();
        const rows = await executeAthenaQuery(query);

        if (rows.length === 0) {
          return successResponse({
            totalSales: 0,
            totalOrders: 0,
            customers: 0,
            averageOrderValue: 0
          });
        }

        const summaryRow = rows[0];
        const summary = {
          totalSales: summaryRow.total_sales || 0,
          totalOrders: summaryRow.total_orders || 0,
          customers: summaryRow.total_customers || 0,
          averageOrderValue: summaryRow.average_order_value ? Math.round(summaryRow.average_order_value * 100) / 100 : 0
        };

        return successResponse(summary);
      }

      case "/customers":
      case "/api/customers": {
        const query = getCustomersQuery();
        const rows = await executeAthenaQuery(query);
        return successResponse({ data: rows });
      }

      case "/city-sales":
      case "/api/city-sales": {
        const query = getCitySalesQuery();
        const rows = await executeAthenaQuery(query);
        return successResponse({ data: rows });
      }

      case "/date-sales":
      case "/api/date-sales": {
        const query = getDateSalesQuery();
        const rows = await executeAthenaQuery(query);
        return successResponse({ data: rows });
      }

      default:
        return errorResponse(`Route '${method} ${path}' not found`, 404);
    }
  } catch (error) {
    console.error(`[Lambda Handler] Error processing route '${path}':`, error);
    return errorResponse(
      "Unable to retrieve analytics. Please check that the Athena federation connector and API are available.",
      500,
      error.message
    );
  }
}

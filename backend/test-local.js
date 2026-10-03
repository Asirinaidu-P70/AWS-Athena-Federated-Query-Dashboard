import { handler } from "./src/handler.js";

async function runLocalTests() {
  console.log("=== Testing Lambda Handler Locally ===");

  // 1. Health check test
  console.log("\n1. Testing GET /health:");
  const healthEvent = {
    rawPath: "/health",
    requestContext: { http: { method: "GET", path: "/health" } }
  };
  const healthRes = await handler(healthEvent);
  console.log("Response:", healthRes);

  // 2. 404 Route test
  console.log("\n2. Testing 404 Route GET /unknown:");
  const notFoundEvent = {
    rawPath: "/unknown",
    requestContext: { http: { method: "GET", path: "/unknown" } }
  };
  const notFoundRes = await handler(notFoundEvent);
  console.log("Response:", notFoundRes);

  console.log("\nLocal tests completed successfully!");
}

runLocalTests().catch(console.error);

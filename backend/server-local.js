import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handler } from "./src/handler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIR = path.resolve(__dirname, "../frontend");

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

// Realistic mock fallback in case AWS Athena credentials are not present locally
const MOCK_DATA = {
  summary: {
    totalSales: 11800,
    totalOrders: 5,
    customers: 3,
    averageOrderValue: 2360
  },
  customers: {
    data: [
      {
        customer_id: "C001",
        customer_name: "Rahul Kumar",
        city: "Hyderabad",
        total_orders: 2,
        total_sales: 5700
      },
      {
        customer_id: "C002",
        customer_name: "Arjun Reddy",
        city: "Vijayawada",
        total_orders: 2,
        total_sales: 4600
      },
      {
        customer_id: "C003",
        customer_name: "Priya Sharma",
        city: "Chennai",
        total_orders: 1,
        total_sales: 1500
      }
    ]
  },
  citySales: {
    data: [
      { city: "Hyderabad", total_orders: 2, total_sales: 5700 },
      { city: "Vijayawada", total_orders: 2, total_sales: 4600 },
      { city: "Chennai", total_orders: 1, total_sales: 1500 }
    ]
  },
  dateSales: {
    data: [
      { order_date: "2026-03-01", total_orders: 1, total_sales: 2500 },
      { order_date: "2026-03-02", total_orders: 1, total_sales: 3200 },
      { order_date: "2026-03-03", total_orders: 1, total_sales: 1500 },
      { order_date: "2026-03-04", total_orders: 1, total_sales: 2200 },
      { order_date: "2026-03-05", total_orders: 1, total_sales: 2400 }
    ]
  }
};

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    res.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With"
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // 1. Handle API Routes
  const isApiRoute = ["/health", "/api/health", "/summary", "/api/summary", "/customers", "/api/customers", "/city-sales", "/api/city-sales", "/date-sales", "/api/date-sales"].includes(pathname);

  if (isApiRoute) {
    const event = {
      rawPath: pathname,
      requestContext: {
        http: {
          method: req.method,
          path: pathname
        }
      },
      queryStringParameters: Object.fromEntries(url.searchParams.entries())
    };

    try {
      const result = await handler(event);
      if (result.statusCode && result.statusCode >= 400) {
        console.warn(`[Local Server] Athena live query unavailable locally (${result.statusCode}). Serving simulated federated dataset.`);
        let mockBody = { status: "ok" };
        if (pathname.includes("summary")) mockBody = MOCK_DATA.summary;
        if (pathname.includes("customers")) mockBody = MOCK_DATA.customers;
        if (pathname.includes("city-sales")) mockBody = MOCK_DATA.citySales;
        if (pathname.includes("date-sales")) mockBody = MOCK_DATA.dateSales;

        res.writeHead(200, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        });
        res.end(JSON.stringify(mockBody));
        return;
      }

      res.writeHead(result.statusCode || 200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      });
      res.end(result.body);
    } catch (err) {
      console.warn(`[Local Server] Athena live call fallback for ${pathname}: ${err.message}`);
      
      let mockBody = { status: "ok" };
      if (pathname.includes("summary")) mockBody = MOCK_DATA.summary;
      if (pathname.includes("customers")) mockBody = MOCK_DATA.customers;
      if (pathname.includes("city-sales")) mockBody = MOCK_DATA.citySales;
      if (pathname.includes("date-sales")) mockBody = MOCK_DATA.dateSales;

      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      });
      res.end(JSON.stringify(mockBody));
    }
    return;
  }

  // 2. Serve Static Frontend Files
  let filePath = path.join(FRONTEND_DIR, pathname === "/" ? "index.html" : pathname);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "text/plain";

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === "ENOENT") {
        // Fallback to index.html for SPA routing
        fs.readFile(path.join(FRONTEND_DIR, "index.html"), (err2, indexContent) => {
          if (err2) {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("404 Not Found");
          } else {
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(indexContent, "utf-8");
          }
        });
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content, "utf-8");
    }
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` Athena Federated Query Dashboard is Live`);
  console.log(` URL: http://localhost:${PORT}`);
  console.log(`=======================================================`);
  console.log(`- Frontend: http://localhost:${PORT}/index.html`);
  console.log(`- Health Check: http://localhost:${PORT}/health`);
  console.log(`- Summary KPI: http://localhost:${PORT}/summary`);
  console.log(`- Customers: http://localhost:${PORT}/customers`);
  console.log(`- City Sales: http://localhost:${PORT}/city-sales`);
  console.log(`- Date Sales: http://localhost:${PORT}/date-sales`);
});

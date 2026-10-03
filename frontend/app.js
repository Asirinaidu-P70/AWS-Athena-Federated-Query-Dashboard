/**
 * Amazon Athena Federated Query Dashboard — Retail Sales Intelligence
 * Live AWS Frontend Controller (Vanilla JavaScript)
 * 
 * Endpoints:
 * - GET /health
 * - GET /summary
 * - GET /customers
 * - GET /city-sales
 * - GET /date-sales
 */

// Global state
let currentCustomerData = [];
let isQueryRunning = false;

// S3 & RDS dataset definition for cross-source display and match tracing
const S3_SALES_DATA = [
  { order_id: 1001, customer_id: "C001", product_id: "P001", order_date: "2026-09-01", amount: 2500 },
  { order_id: 1002, customer_id: "C002", product_id: "P002", order_date: "2026-09-01", amount: 1800 },
  { order_id: 1003, customer_id: "C001", product_id: "P003", order_date: "2026-09-02", amount: 3200 },
  { order_id: 1004, customer_id: "C003", product_id: "P001", order_date: "2026-09-02", amount: 1500 },
  { order_id: 1005, customer_id: "C002", product_id: "P003", order_date: "2026-09-03", amount: 2800 }
];

const RDS_CUSTOMERS_DATA = [
  { customer_id: "C001", customer_name: "Rahul Kumar", city: "Hyderabad" },
  { customer_id: "C002", customer_name: "Arjun Reddy", city: "Vijayawada" },
  { customer_id: "C003", customer_name: "Priya Sharma", city: "Chennai" }
];

// -------------------------------------------------------------
// Icon Initializer
// -------------------------------------------------------------
function renderIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// -------------------------------------------------------------
// Currency & Number Formatters
// -------------------------------------------------------------
function formatCurrency(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
}

function formatNumber(num) {
  if (num === undefined || num === null || isNaN(num)) return "0";
  return Number(num).toLocaleString("en-IN");
}

// -------------------------------------------------------------
// Toast Notifications
// -------------------------------------------------------------
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "toast-item";

  let iconName = "info";
  let iconColor = "text-blue-400";
  if (type === "success") {
    iconName = "check-circle";
    iconColor = "text-emerald-400";
  } else if (type === "error") {
    iconName = "alert-circle";
    iconColor = "text-rose-400";
  }

  toast.innerHTML = `
    <i data-lucide="${iconName}" class="w-4 h-4 ${iconColor} flex-shrink-0"></i>
    <span class="text-xs font-medium text-slate-200">${message}</span>
  `;

  container.appendChild(toast);
  renderIcons();

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(6px)";
    toast.style.transition = "all 0.2s ease-in";
    setTimeout(() => toast.remove(), 200);
  }, 3500);
}

// -------------------------------------------------------------
// Alert Banner Messages
// -------------------------------------------------------------
function showError(message) {
  const alertBanner = document.getElementById("alertBanner");
  const alertTitle = document.getElementById("alertTitle");
  const alertMessage = document.getElementById("alertMessage");

  if (!alertBanner) return;
  alertBanner.className = "p-3.5 rounded-lg border border-rose-500/30 bg-rose-950/30 text-xs";
  alertTitle.textContent = "Unable to load analytics";
  alertMessage.textContent = message || "Please check your network connection and try again.";
  alertBanner.classList.remove("hidden");
}

function showSuccess(message) {
  showToast(message, "success");
}

function hideAlert() {
  const alertBanner = document.getElementById("alertBanner");
  if (alertBanner) alertBanner.classList.add("hidden");
}

// -------------------------------------------------------------
// API Utility
// -------------------------------------------------------------
async function apiGet(path) {
  const baseUrl = (window.CONFIG?.API_BASE_URL || window.API_BASE_URL || "").replace(/\/$/, "");
  if (!baseUrl) {
    throw new Error("API_BASE_URL is not configured.");
  }

  const timeoutMs = window.CONFIG?.REQUEST_TIMEOUT_MS || 45000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API request failed: ${response.status} (${response.statusText})`);
    }

    return await response.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error("API request timed out while waiting for Athena federated query.");
    }
    throw err;
  }
}

// -------------------------------------------------------------
// Modular Fetch Functions
// -------------------------------------------------------------
async function fetchHealth() {
  return await apiGet("/health");
}

async function fetchSummary() {
  return await apiGet("/summary");
}

async function fetchCustomers(customerId = null) {
  const queryParam = customerId && customerId !== "ALL" ? `?customer_id=${encodeURIComponent(customerId)}` : "";
  return await apiGet(`/customers${queryParam}`);
}

async function fetchCitySales() {
  return await apiGet("/city-sales");
}

async function fetchDateSales() {
  return await apiGet("/date-sales");
}

// -------------------------------------------------------------
// Render Summary KPIs
// -------------------------------------------------------------
function renderSummary(data) {
  const kpiTotalSales = document.getElementById("kpiTotalSales");
  const kpiTotalOrders = document.getElementById("kpiTotalOrders");
  const kpiCustomers = document.getElementById("kpiCustomers");
  const kpiAvgOrderValue = document.getElementById("kpiAvgOrderValue");
  const lastQueryTimestamp = document.getElementById("lastQueryTimestamp");

  if (!data) return;

  if (kpiTotalSales) kpiTotalSales.textContent = formatCurrency(data.totalSales);
  if (kpiTotalOrders) kpiTotalOrders.textContent = formatNumber(data.totalOrders);
  if (kpiCustomers) kpiCustomers.textContent = formatNumber(data.customers);
  if (kpiAvgOrderValue) kpiAvgOrderValue.textContent = formatCurrency(data.averageOrderValue);
  if (lastQueryTimestamp) lastQueryTimestamp.textContent = `Last Update: ${new Date().toLocaleTimeString()}`;
}

// -------------------------------------------------------------
// Render Aggregated Customer Leaderboard Table
// -------------------------------------------------------------
function renderCustomers(customers = []) {
  const tableBody = document.getElementById("customerTableBody");
  const rowCountBadge = document.getElementById("customerRowCount");

  if (!tableBody) return;

  if (!customers || customers.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="px-6 py-10 text-center text-slate-500 font-sans">
          No customer records returned from Athena.
        </td>
      </tr>
    `;
    if (rowCountBadge) rowCountBadge.textContent = "0 records";
    renderIcons();
    return;
  }

  if (rowCountBadge) {
    rowCountBadge.textContent = `${customers.length} ${customers.length === 1 ? 'record' : 'records'}`;
  }

  tableBody.innerHTML = customers.map((c, index) => {
    const rank = index + 1;
    let rankBadge = `<span class="inline-flex items-center justify-center w-5 h-5 rounded bg-slate-800 text-slate-400 font-mono text-[10px]">${rank}</span>`;
    if (rank === 1) {
      rankBadge = `<span class="inline-flex items-center justify-center w-5 h-5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-[10px] font-bold">#1</span>`;
    } else if (rank === 2) {
      rankBadge = `<span class="inline-flex items-center justify-center w-5 h-5 rounded bg-slate-400/20 text-slate-200 border border-slate-400/40 font-mono text-[10px] font-bold">#2</span>`;
    } else if (rank === 3) {
      rankBadge = `<span class="inline-flex items-center justify-center w-5 h-5 rounded bg-amber-700/20 text-amber-400 border border-amber-700/40 font-mono text-[10px] font-bold">#3</span>`;
    }

    const customerName = c.customer_name || c.customerName || "Unknown Customer";
    const city = c.city || "--";
    const orderCount = c.order_count ?? c.total_orders ?? 0;
    const totalAmount = c.total_amount ?? c.total_sales ?? 0;

    return `
      <tr class="hover:bg-[#131e35] transition-colors cursor-pointer" onclick="selectCustomerByName('${customerName}')">
        <td class="text-center">${rankBadge}</td>
        <td class="font-sans font-semibold text-white">${customerName}</td>
        <td class="font-sans text-slate-300">
          <span class="inline-flex items-center space-x-1.5">
            <i data-lucide="map-pin" class="w-3 h-3 text-slate-500"></i>
            <span>${city}</span>
          </span>
        </td>
        <td class="text-right font-mono text-slate-300 font-semibold tabular-nums">${formatNumber(orderCount)}</td>
        <td class="text-right font-mono text-emerald-400 font-bold tabular-nums">${formatCurrency(totalAmount)}</td>
      </tr>
    `;
  }).join("");

  renderIcons();
}

// -------------------------------------------------------------
// Render Interactive Federated Query Result Card
// -------------------------------------------------------------
function renderInteractiveQueryResult(selectedVal, customersList) {
  const resCustomerName = document.getElementById("resCustomerName");
  const resCustomerId = document.getElementById("resCustomerId");
  const resCityLocation = document.getElementById("resCityLocation");
  const resOrdersCount = document.getElementById("resOrdersCount");
  const resTotalSales = document.getElementById("resTotalSales");
  const matchedOrdersTableBody = document.getElementById("matchedOrdersTableBody");

  if (!customersList || customersList.length === 0) return;

  let targetCustomer = null;
  let targetId = "C001";

  if (selectedVal === "ALL") {
    // Show top customer or combined
    targetCustomer = customersList[0];
    const matchCust = RDS_CUSTOMERS_DATA.find(r => r.customer_name.toLowerCase() === (targetCustomer.customer_name || "").toLowerCase());
    targetId = matchCust ? matchCust.customer_id : "C001";
  } else {
    targetId = selectedVal;
    const rdsEntry = RDS_CUSTOMERS_DATA.find(r => r.customer_id === selectedVal);
    if (rdsEntry) {
      targetCustomer = customersList.find(c => (c.customer_name || "").toLowerCase() === rdsEntry.customer_name.toLowerCase()) || {
        customer_name: rdsEntry.customer_name,
        city: rdsEntry.city,
        order_count: 0,
        total_amount: 0
      };
    } else {
      targetCustomer = customersList[0];
    }
  }

  if (!targetCustomer) return;

  const custName = targetCustomer.customer_name || "Unknown";
  const custCity = targetCustomer.city || "--";
  const orderCount = targetCustomer.order_count ?? targetCustomer.total_orders ?? 0;
  const totalAmount = targetCustomer.total_amount ?? targetCustomer.total_sales ?? 0;

  if (resCustomerName) resCustomerName.textContent = custName;
  if (resCustomerId) resCustomerId.textContent = targetId;
  if (resCityLocation) resCityLocation.textContent = `City: ${custCity} (RDS MySQL)`;
  if (resOrdersCount) resOrdersCount.textContent = `Orders: ${orderCount} (Amazon S3)`;
  if (resTotalSales) resTotalSales.textContent = formatCurrency(totalAmount);

  // Filter S3 matching orders for this customer ID
  const matchedOrders = S3_SALES_DATA.filter(o => o.customer_id === targetId);

  if (matchedOrdersTableBody) {
    if (matchedOrders.length === 0) {
      matchedOrdersTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-4 text-slate-500 font-sans">
            No matching S3 sales orders found for customer ID ${targetId}.
          </td>
        </tr>
      `;
    } else {
      matchedOrdersTableBody.innerHTML = matchedOrders.map(o => `
        <tr class="hover:bg-[#131e35] transition-colors">
          <td class="font-bold text-amber-300 font-mono">${o.order_id}</td>
          <td class="text-blue-300 font-mono font-semibold">${o.customer_id}</td>
          <td class="text-slate-400 font-mono">${o.product_id}</td>
          <td class="text-slate-300 font-mono">${o.order_date}</td>
          <td class="text-right font-bold text-emerald-400 font-mono">${formatCurrency(o.amount)}</td>
        </tr>
      `).join("");
    }
  }

  renderIcons();
}

// -------------------------------------------------------------
// Render Sales by City
// -------------------------------------------------------------
function renderCitySales(cityData = []) {
  const container = document.getElementById("citySalesContainer");
  if (!container) return;

  if (!cityData || cityData.length === 0) {
    container.innerHTML = `<div class="text-xs text-slate-500 py-6 text-center">No city data available</div>`;
    return;
  }

  const maxAmount = Math.max(...cityData.map(c => Number(c.total_amount ?? c.total_sales) || 1));

  container.innerHTML = cityData.map(item => {
    const city = item.city || "Unknown";
    const orderCount = item.order_count ?? item.total_orders ?? 0;
    const totalAmount = Number(item.total_amount ?? item.total_sales) || 0;
    const percentage = Math.max(8, Math.round((totalAmount / maxAmount) * 100));

    return `
      <div class="p-3 rounded-lg bg-[#0C1322] border border-[#1E293B]">
        <div class="flex items-center justify-between text-xs mb-1.5">
          <div class="font-semibold text-white flex items-center space-x-2">
            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>${city}</span>
          </div>
          <div class="flex items-center space-x-3 font-mono text-xs">
            <span class="text-slate-400">${orderCount} ${orderCount === 1 ? 'order' : 'orders'}</span>
            <span class="font-bold text-emerald-400">${formatCurrency(totalAmount)}</span>
          </div>
        </div>
        <div class="w-full bg-[#151F33] h-1.5 rounded-full overflow-hidden">
          <div class="bg-gradient-to-r from-emerald-500 to-teal-400 h-1.5 rounded-full transition-all duration-500" style="width: ${percentage}%"></div>
        </div>
      </div>
    `;
  }).join("");
}

// -------------------------------------------------------------
// Render Sales by Date
// -------------------------------------------------------------
function renderDateSales(dateData = []) {
  const container = document.getElementById("dateSalesContainer");
  if (!container) return;

  if (!dateData || dateData.length === 0) {
    container.innerHTML = `<div class="text-xs text-slate-500 py-6 text-center">No date trend data available</div>`;
    return;
  }

  const maxAmount = Math.max(...dateData.map(d => Number(d.total_amount ?? d.total_sales) || 1));

  container.innerHTML = dateData.map(item => {
    const orderDate = item.order_date || "--";
    const orderCount = item.order_count ?? item.total_orders ?? 0;
    const totalAmount = Number(item.total_amount ?? item.total_sales) || 0;
    const percentage = Math.max(8, Math.round((totalAmount / maxAmount) * 100));

    return `
      <div class="p-3 rounded-lg bg-[#0C1322] border border-[#1E293B]">
        <div class="flex items-center justify-between text-xs mb-1.5">
          <div class="font-semibold text-white flex items-center space-x-2">
            <span class="w-2 h-2 rounded-full bg-blue-400"></span>
            <span class="font-mono text-xs">${orderDate}</span>
          </div>
          <div class="flex items-center space-x-3 font-mono text-xs">
            <span class="text-slate-400">${orderCount} ${orderCount === 1 ? 'order' : 'orders'}</span>
            <span class="font-bold text-blue-400">${formatCurrency(totalAmount)}</span>
          </div>
        </div>
        <div class="w-full bg-[#151F33] h-1.5 rounded-full overflow-hidden">
          <div class="bg-gradient-to-r from-blue-500 to-indigo-400 h-1.5 rounded-full transition-all duration-500" style="width: ${percentage}%"></div>
        </div>
      </div>
    `;
  }).join("");
}

// -------------------------------------------------------------
// Loading State Visualizer
// -------------------------------------------------------------
function showLoading() {
  const tableBody = document.getElementById("customerTableBody");
  const cityContainer = document.getElementById("citySalesContainer");
  const dateContainer = document.getElementById("dateSalesContainer");
  const matchedOrdersTableBody = document.getElementById("matchedOrdersTableBody");

  if (tableBody) {
    tableBody.innerHTML = `
      ${[1, 2, 3].map(() => `
        <tr class="animate-pulse">
          <td class="text-center py-4"><div class="skeleton-line h-4 w-6 mx-auto"></div></td>
          <td class="py-4"><div class="skeleton-line h-4 w-32"></div></td>
          <td class="py-4"><div class="skeleton-line h-4 w-24"></div></td>
          <td class="text-right py-4"><div class="skeleton-line h-4 w-12 ml-auto"></div></td>
          <td class="text-right py-4"><div class="skeleton-line h-4 w-20 ml-auto"></div></td>
        </tr>
      `).join("")}
    `;
  }

  if (matchedOrdersTableBody) {
    matchedOrdersTableBody.innerHTML = `
      ${[1, 2].map(() => `
        <tr class="animate-pulse">
          <td class="py-3"><div class="skeleton-line h-4 w-12"></div></td>
          <td class="py-3"><div class="skeleton-line h-4 w-12"></div></td>
          <td class="py-3"><div class="skeleton-line h-4 w-12"></div></td>
          <td class="py-3"><div class="skeleton-line h-4 w-20"></div></td>
          <td class="text-right py-3"><div class="skeleton-line h-4 w-16 ml-auto"></div></td>
        </tr>
      `).join("")}
    `;
  }

  if (cityContainer) {
    cityContainer.innerHTML = `<div class="text-xs text-slate-500 py-6 text-center animate-pulse">Querying Amazon Athena for city distribution...</div>`;
  }

  if (dateContainer) {
    dateContainer.innerHTML = `<div class="text-xs text-slate-500 py-6 text-center animate-pulse">Querying Amazon Athena for sales timeline...</div>`;
  }
}

// -------------------------------------------------------------
// Check Backend Health
// -------------------------------------------------------------
async function checkBackendHealth() {
  const liveDot = document.getElementById("liveDot");
  const liveStatusText = document.getElementById("liveStatusText");
  const statusBackend = document.getElementById("statusBackend");
  const statusApi = document.getElementById("statusApi");
  const systemStatusBadge = document.getElementById("systemStatusBadge");

  try {
    const health = await fetchHealth();
    if (health && health.status === "ok") {
      if (liveDot) liveDot.className = "w-2 h-2 rounded-full bg-emerald-400";
      if (liveStatusText) liveStatusText.textContent = "LIVE / AWS Connected";
      if (statusBackend) statusBackend.textContent = "● Operational";
      if (statusApi) statusApi.textContent = "● Connected";
      if (systemStatusBadge) {
        systemStatusBadge.className = "badge-pill badge-live text-[10px]";
        systemStatusBadge.textContent = "● Operational";
      }
      return true;
    }
  } catch (err) {
    console.warn("[Athena Dashboard] Health check warning:", err.message);
    if (liveDot) liveDot.className = "w-2 h-2 rounded-full bg-rose-500";
    if (liveStatusText) liveStatusText.textContent = "API Offline";
    if (statusBackend) statusBackend.textContent = "● Offline";
    if (statusApi) statusApi.textContent = "● Disconnected";
    if (systemStatusBadge) {
      systemStatusBadge.className = "badge-pill badge-neutral text-[10px]";
      systemStatusBadge.textContent = "● Service Offline";
    }
    return false;
  }
}

// -------------------------------------------------------------
// Main Action: Run Federated Query
// -------------------------------------------------------------
async function runFederatedQuery() {
  if (isQueryRunning) return;
  isQueryRunning = true;

  const btnRunQuery = document.getElementById("btnRunQuery");
  const btnIcon = document.getElementById("btnIcon");
  const btnText = document.getElementById("btnText");
  const queryStatus = document.getElementById("queryExecutionStatus");
  const customerSelect = document.getElementById("customerSelect");

  const selectedVal = customerSelect ? customerSelect.value : "ALL";

  // Update button to loading state
  if (btnRunQuery) {
    btnRunQuery.disabled = true;
    if (btnIcon) {
      btnIcon.setAttribute("data-lucide", "loader-2");
      btnIcon.classList.add("animate-spin");
    }
    if (btnText) btnText.textContent = "Running Federated Query...";
    renderIcons();
  }

  if (queryStatus) {
    queryStatus.textContent = "Executing Athena Federated Query...";
    queryStatus.className = "text-xs font-mono text-amber-400";
  }

  showLoading();
  hideAlert();

  const startTime = performance.now();

  try {
    // Concurrent fetch from live AWS API Gateway
    const [summaryRes, customersRes, cityRes, dateRes] = await Promise.all([
      fetchSummary(),
      fetchCustomers(selectedVal),
      fetchCitySales(),
      fetchDateSales()
    ]);

    const elapsed = Math.round(performance.now() - startTime);

    // 1. Populate KPI Cards
    if (summaryRes) {
      renderSummary(summaryRes);
    }

    // 2. Populate Customer Table
    currentCustomerData = customersRes?.data || [];
    renderCustomers(currentCustomerData);

    // 3. Populate Interactive Result Card for Selected Customer
    renderInteractiveQueryResult(selectedVal, currentCustomerData);

    // 4. Populate City & Date Breakdowns
    renderCitySales(cityRes?.data || []);
    renderDateSales(dateRes?.data || []);

    // 5. Update Button & Feedback
    if (btnText) btnText.textContent = "Federated Query Completed";
    if (btnIcon) {
      btnIcon.setAttribute("data-lucide", "check-circle");
      btnIcon.classList.remove("animate-spin");
    }
    if (queryStatus) {
      queryStatus.textContent = `Federated Query Complete (${elapsed}ms)`;
      queryStatus.className = "text-xs font-mono text-emerald-400";
    }
    renderIcons();

    showSuccess(`Athena Federated Query completed in ${elapsed}ms`);

    setTimeout(() => {
      if (btnText) btnText.textContent = "RUN FEDERATED QUERY";
      if (btnIcon) btnIcon.setAttribute("data-lucide", "play");
      if (btnRunQuery) btnRunQuery.disabled = false;
      renderIcons();
    }, 1500);

  } catch (err) {
    console.error("[Athena Dashboard] Query Execution Failed:", err);
    showError(err.message || "Unable to retrieve data from the analytics API.");

    if (btnText) btnText.textContent = "RUN FEDERATED QUERY";
    if (btnIcon) {
      btnIcon.setAttribute("data-lucide", "play");
      btnIcon.classList.remove("animate-spin");
    }
    if (btnRunQuery) btnRunQuery.disabled = false;
    if (queryStatus) {
      queryStatus.textContent = "Query execution failed";
      queryStatus.className = "text-xs font-mono text-rose-400";
    }
    renderIcons();
  } finally {
    isQueryRunning = false;
  }
}

// Global helper for row clicks
window.selectCustomerByName = function(customerName) {
  const matchRds = RDS_CUSTOMERS_DATA.find(r => r.customer_name.toLowerCase() === (customerName || "").toLowerCase());
  const customerSelect = document.getElementById("customerSelect");
  if (customerSelect && matchRds) {
    customerSelect.value = matchRds.customer_id;
    runFederatedQuery();
    // Scroll to interactive section smoothly
    document.getElementById("federatedResultCard")?.scrollIntoView({ behavior: "smooth" });
  }
};

// -------------------------------------------------------------
// CSV Export Function
// -------------------------------------------------------------
function exportCustomerCsv() {
  if (!currentCustomerData || currentCustomerData.length === 0) {
    showToast("No customer records available to export.", "error");
    return;
  }

  const headers = ["Rank", "Customer", "City", "Orders", "Total Sales (INR)"];
  const rows = currentCustomerData.map((c, i) => [
    i + 1,
    `"${(c.customer_name || c.customerName || "").replace(/"/g, '""')}"`,
    `"${(c.city || "").replace(/"/g, '""')}"`,
    c.order_count ?? c.total_orders ?? 0,
    c.total_amount ?? c.total_sales ?? 0
  ]);

  const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `athena_federated_customer_sales_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showSuccess(`Exported ${currentCustomerData.length} records to CSV`);
}

// -------------------------------------------------------------
// DOM Ready Setup & Event Listeners
// -------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {


  // Render icons first
  renderIcons();

  const btnRunQuery = document.getElementById("btnRunQuery");
  const btnRetryAlert = document.getElementById("btnRetryAlert");
  const btnCloseAlert = document.getElementById("btnCloseAlert");
  const customerSearchInput = document.getElementById("customerSearchInput");


  // Run Query button listener
  if (btnRunQuery) {
    btnRunQuery.addEventListener("click", runFederatedQuery);
  }

  // Dropdown change triggers query
  if (customerSelect) {
    customerSelect.addEventListener("change", () => {
      runFederatedQuery();
    });
  }

  // Retry Alert button
  if (btnRetryAlert) {
    btnRetryAlert.addEventListener("click", () => {
      hideAlert();
      runFederatedQuery();
    });
  }

  // Close Alert button
  if (btnCloseAlert) {
    btnCloseAlert.addEventListener("click", hideAlert);
  }

  // Live Customer Search Filter
  if (customerSearchInput) {
    customerSearchInput.addEventListener("input", (e) => {
      const term = (e.target.value || "").trim().toLowerCase();
      if (!term) {
        renderCustomers(currentCustomerData);
        return;
      }
      const filtered = currentCustomerData.filter(c => {
        const name = (c.customer_name || c.customerName || "").toLowerCase();
        const city = (c.city || "").toLowerCase();
        return name.includes(term) || city.includes(term);
      });
      renderCustomers(filtered);
    });
  }

  // CSV Export Listener
  if (btnExportCsv) {
    btnExportCsv.addEventListener("click", exportCustomerCsv);
  }

  // Copy SQL Query
  if (btnCopySql) {
    btnCopySql.addEventListener("click", () => {
      const sqlText = `SELECT
    c.customer_name,
    c.city,
    COUNT(s.order_id) AS order_count,
    SUM(s.amount) AS total_amount
  FROM retail_analytics.sales s
  JOIN rds_mysql_catalog.retaildb.customers c
    ON s.customer_id = c.customer_id
  GROUP BY
    c.customer_name,
    c.city
  ORDER BY total_amount DESC;`;
      navigator.clipboard.writeText(sqlText).then(() => {
        showSuccess("SQL query copied to clipboard");
      }).catch(() => {
        showToast("Unable to copy SQL", "error");
      });
    });
  }

  // Toggle SQL Block visibility
  let isSqlCollapsed = false;
  if (btnToggleSql && sqlBlockContainer) {
    btnToggleSql.addEventListener("click", () => {
      isSqlCollapsed = !isSqlCollapsed;
      if (isSqlCollapsed) {
        sqlBlockContainer.classList.add("hidden");
        if (toggleSqlLabel) toggleSqlLabel.textContent = "Expand";
        if (toggleSqlIcon) toggleSqlIcon.setAttribute("data-lucide", "chevron-down");
      } else {
        sqlBlockContainer.classList.remove("hidden");
        if (toggleSqlLabel) toggleSqlLabel.textContent = "Collapse";
        if (toggleSqlIcon) toggleSqlIcon.setAttribute("data-lucide", "chevron-up");
      }
      renderIcons();
    });
  }

  // Keyboard shortcut Ctrl+Enter / Cmd+Enter to run query
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      runFederatedQuery();
    }
  });

  
  checkBackendHealth();
  runFederatedQuery();

  
  
  


  


  
  
  


  // Run Query button listener
  if (btnRunQuery) {
    btnRunQuery.addEventListener("click", runFederatedQuery);
  }

  // When customer dropdown changes, auto-trigger or prepare query
  if (customerSelect) {
    customerSelect.addEventListener("change", () => {
      runFederatedQuery();
    });
  }

  // Retry Alert button
  if (btnRetryAlert) {
    btnRetryAlert.addEventListener("click", () => {
      hideAlert();
      runFederatedQuery();
    });
  }

  // Close Alert
  if (btnCloseAlert) {
    btnCloseAlert.addEventListener("click", hideAlert);
  }

  // Live Customer Search Filter
  if (customerSearchInput) {
    customerSearchInput.addEventListener("input", (e) => {
      const term = (e.target.value || "").trim().toLowerCase();
      if (!term) {
        renderCustomers(currentCustomerData);
        return;
      }
      const filtered = currentCustomerData.filter(c => {
        const name = (c.customer_name || c.customerName || "").toLowerCase();
        const city = (c.city || "").toLowerCase();
        return name.includes(term) || city.includes(term);
      });
      renderCustomers(filtered);
    });
  }

  // CSV Export Listener
  if (btnExportCsv) {
    btnExportCsv.addEventListener("click", exportCustomerCsv);
  }

  // Copy SQL Query
  if (btnCopySql) {
    btnCopySql.addEventListener("click", () => {
      const sqlText = `SELECT
    c.customer_name,
    c.city,
    COUNT(s.order_id) AS order_count,
    SUM(s.amount) AS total_amount
FROM retail_analytics.sales s
JOIN rds_mysql_catalog.retaildb.customers c
    ON s.customer_id = c.customer_id
GROUP BY
    c.customer_name,
    c.city
ORDER BY total_amount DESC;`;

      navigator.clipboard.writeText(sqlText).then(() => {
        showSuccess("SQL query copied to clipboard");
      }).catch(() => {
        showToast("Unable to copy SQL", "error");
      });
    });
  }


});

/**
 * SQL Query definitions for Retail Sales Intelligence Athena Federated Analytics.
 * Reads catalog and database identifiers from environment variables.
 */

const getS3Database = () => process.env.ATHENA_S3_DATABASE || "retail_analytics";
const getRdsCatalog = () => process.env.ATHENA_RDS_CATALOG || "rds_mysql_catalog";
const getRdsDatabase = () => process.env.ATHENA_RDS_DATABASE || "retaildb";

/**
 * Returns SQL query for overall sales KPI summary.
 */
export function getSummaryQuery() {
  const s3Db = getS3Database();
  const rdsCatalog = getRdsCatalog();
  const rdsDb = getRdsDatabase();

  return `
    SELECT
      COUNT(s.order_id) AS total_orders,
      COALESCE(SUM(s.amount), 0) AS total_sales,
      COUNT(DISTINCT c.customer_id) AS total_customers,
      COALESCE(AVG(s.amount), 0) AS average_order_value
    FROM ${s3Db}.sales s
    JOIN ${rdsCatalog}.${rdsDb}.customers c
      ON s.customer_id = c.customer_id;
  `.trim();
}

/**
 * Returns SQL query for federated Customer Sales analysis.
 * Performs a distributed join between S3 historical sales and RDS MySQL customer metadata.
 */
export function getCustomersQuery() {
  const s3Db = getS3Database();
  const rdsCatalog = getRdsCatalog();
  const rdsDb = getRdsDatabase();

  return `
    SELECT
      c.customer_id,
      c.customer_name,
      c.city,
      COUNT(s.order_id) AS total_orders,
      SUM(s.amount) AS total_sales
    FROM ${s3Db}.sales s
    JOIN ${rdsCatalog}.${rdsDb}.customers c
      ON s.customer_id = c.customer_id
    GROUP BY
      c.customer_id,
      c.customer_name,
      c.city
    ORDER BY total_sales DESC;
  `.trim();
}

/**
 * Returns SQL query for City-wise sales breakdown.
 */
export function getCitySalesQuery() {
  const s3Db = getS3Database();
  const rdsCatalog = getRdsCatalog();
  const rdsDb = getRdsDatabase();

  return `
    SELECT
      c.city,
      COUNT(s.order_id) AS total_orders,
      SUM(s.amount) AS total_sales
    FROM ${s3Db}.sales s
    JOIN ${rdsCatalog}.${rdsDb}.customers c
      ON s.customer_id = c.customer_id
    GROUP BY
      c.city
    ORDER BY total_sales DESC;
  `.trim();
}

/**
 * Returns SQL query for Date-wise sales trend from S3 historical data.
 */
export function getDateSalesQuery() {
  const s3Db = getS3Database();

  return `
    SELECT
      s.order_date,
      COUNT(s.order_id) AS total_orders,
      SUM(s.amount) AS total_sales
    FROM ${s3Db}.sales s
    GROUP BY
      s.order_date
    ORDER BY s.order_date ASC;
  `.trim();
}

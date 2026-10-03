/**
 * Amazon Athena Federated Query Dashboard — Configuration
 * Live AWS API Gateway Endpoint
 */

const CONFIG = {
  // Live AWS API Gateway HTTP API Endpoint
  API_BASE_URL: "https://pzp71tra0g.execute-api.eu-north-1.amazonaws.com",
  
  // Timeout in milliseconds for live Athena query execution
  REQUEST_TIMEOUT_MS: 45000,

  // AWS Architecture metadata
  AWS_REGION: "eu-north-1",
  ATHENA_WORKGROUP: "primary",
  S3_DATA_PATH: "s3://athena-s3-rds-demo-2026-361646636192-eu-north-1-an/sales/sales.csv",
  RDS_DATABASE: "retaildb",
  RDS_TABLE: "customers",
  S3_TABLE: "retail_analytics.sales",
  CATALOG_NAME: "rds_mysql_catalog"
};

// Global shorthand for direct access
const API_BASE_URL = CONFIG.API_BASE_URL;

window.CONFIG = CONFIG;
window.API_BASE_URL = API_BASE_URL;

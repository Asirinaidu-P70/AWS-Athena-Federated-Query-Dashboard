import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  GetQueryResultsCommand
} from "@aws-sdk/client-athena";

const region = process.env.AWS_REGION || "eu-north-1";
const athenaClient = new AthenaClient({ region });

/**
 * Executes an Athena query asynchronously, polls for completion, and returns parsed JSON rows.
 * @param {string} queryString - The SQL query to execute.
 * @returns {Promise<Array<Object>>} - Array of row objects.
 */
export async function executeAthenaQuery(queryString) {
  const workgroup = process.env.ATHENA_WORKGROUP || "primary";
  const database = process.env.ATHENA_S3_DATABASE || "retail_analytics";
  const outputLocation = process.env.ATHENA_OUTPUT_LOCATION;

  const startParams = {
    QueryString: queryString,
    QueryExecutionContext: {
      Database: database
    },
    WorkGroup: workgroup
  };

  if (outputLocation) {
    startParams.ResultConfiguration = {
      OutputLocation: outputLocation
    };
  }

  console.log(`[Athena] Starting query execution in workgroup "${workgroup}"...`);
  console.log(`[Athena] SQL: ${queryString.replace(/\s+/g, " ")}`);

  const startCommand = new StartQueryExecutionCommand(startParams);
  const startResponse = await athenaClient.send(startCommand);
  const queryExecutionId = startResponse.QueryExecutionId;

  if (!queryExecutionId) {
    throw new Error("Failed to obtain QueryExecutionId from Athena.");
  }

  console.log(`[Athena] Query ID: ${queryExecutionId}. Waiting for completion...`);

  // Poll until query finishes
  await waitForQueryToComplete(queryExecutionId);

  // Retrieve and parse query results
  const results = await fetchQueryResults(queryExecutionId);
  console.log(`[Athena] Query ${queryExecutionId} completed successfully. Returned ${results.length} rows.`);
  return results;
}

/**
 * Polls Athena GetQueryExecution until status is SUCCEEDED, FAILED, or CANCELLED.
 * @param {string} queryExecutionId 
 */
async function waitForQueryToComplete(queryExecutionId, maxWaitTimeMs = 45000, pollIntervalMs = 800) {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTimeMs) {
    const getCommand = new GetQueryExecutionCommand({
      QueryExecutionId: queryExecutionId
    });

    const execution = await athenaClient.send(getCommand);
    const status = execution.QueryExecution?.Status?.State;
    const reason = execution.QueryExecution?.Status?.StateChangeReason;

    console.log(`[Athena] Query ${queryExecutionId} status: ${status}`);

    if (status === "SUCCEEDED") {
      return execution;
    }

    if (status === "FAILED") {
      throw new Error(`Athena query failed: ${reason || "Unknown error"}`);
    }

    if (status === "CANCELLED") {
      throw new Error(`Athena query was cancelled: ${reason || "Unknown reason"}`);
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Athena query timed out after ${maxWaitTimeMs / 1000} seconds.`);
}

/**
 * Fetches and transforms Athena tabular result rows into clean JavaScript objects.
 * @param {string} queryExecutionId 
 * @returns {Promise<Array<Object>>}
 */
async function fetchQueryResults(queryExecutionId) {
  const resultsCommand = new GetQueryResultsCommand({
    QueryExecutionId: queryExecutionId
  });

  const response = await athenaClient.send(resultsCommand);
  const rows = response.ResultSet?.Rows || [];

  if (rows.length === 0) {
    return [];
  }

  // First row is the header containing column names
  const columnInfo = response.ResultSet?.ResultSetMetadata?.ColumnInfo || [];
  const columnNames = rows[0].Data?.map((col, idx) => {
    return columnInfo[idx]?.Name || col.VarCharValue || `col_${idx}`;
  }) || [];

  const dataRows = rows.slice(1);

  return dataRows.map((row) => {
    const rowObj = {};
    row.Data?.forEach((col, idx) => {
      const colName = columnNames[idx];
      const rawValue = col.VarCharValue !== undefined ? col.VarCharValue : null;
      
      // Auto-cast numeric values where appropriate
      if (rawValue !== null && !isNaN(rawValue) && rawValue.trim() !== "") {
        // If integer or decimal number
        const num = Number(rawValue);
        rowObj[colName] = num;
      } else {
        rowObj[colName] = rawValue;
      }
    });
    return rowObj;
  });
}

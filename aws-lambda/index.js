/**
 * AWS Lambda function for World Tapper
 * 
 * This function handles:
 * - GET: Returns the current global click count
 * - POST: Increments the click count and returns the new value
 * 
 * DynamoDB Table Structure:
 * - Table Name: WorldClickerCounter
 * - Partition Key: id (String) - Always "global"
 * - Attribute: count (Number) - The click count
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, UpdateCommand, ScanCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "WorldClickerCounter";
const CONNECTIONS_TABLE = "WorldClickerConnections";
const COUNTER_ID = "global";

// WebSocket API endpoint - will be set after creating the WebSocket API
const WS_ENDPOINT = process.env.WEBSOCKET_ENDPOINT;

// CORS headers for cross-origin requests
const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Broadcast count to all connected WebSocket clients
async function broadcastCount(count) {
  if (!WS_ENDPOINT) {
    console.log("WebSocket endpoint not configured, skipping broadcast");
    return;
  }

  const apiClient = new ApiGatewayManagementApiClient({ endpoint: WS_ENDPOINT });

  // Get all connections
  const connections = await docClient.send(
    new ScanCommand({ TableName: CONNECTIONS_TABLE })
  );

  if (!connections.Items || connections.Items.length === 0) {
    console.log("No connections to broadcast to");
    return;
  }

  console.log(`Broadcasting to ${connections.Items.length} connections`);

  // Send to all connections
  const sendPromises = connections.Items.map(async ({ connectionId }) => {
    try {
      await apiClient.send(
        new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: JSON.stringify({ type: "count", count }),
        })
      );
    } catch (error) {
      if (error.statusCode === 410) {
        // Connection is stale, remove it
        console.log(`Removing stale connection: ${connectionId}`);
        await docClient.send(
          new DeleteCommand({
            TableName: CONNECTIONS_TABLE,
            Key: { connectionId },
          })
        );
      } else {
        console.error(`Failed to send to ${connectionId}:`, error);
      }
    }
  });

  await Promise.all(sendPromises);
}

exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  const httpMethod = event.httpMethod || event.requestContext?.http?.method;

  try {
    // Handle CORS preflight
    if (httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers,
        body: "",
      };
    }

    // GET - Retrieve current count
    if (httpMethod === "GET") {
      const result = await docClient.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: { id: COUNTER_ID },
        })
      );

      const count = result.Item?.count || 0;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ count }),
      };
    }

    // POST - Increment counter
    if (httpMethod === "POST") {
      const result = await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { id: COUNTER_ID },
          UpdateExpression: "SET #count = if_not_exists(#count, :zero) + :inc",
          ExpressionAttributeNames: { "#count": "count" },
          ExpressionAttributeValues: { ":zero": 0, ":inc": 1 },
          ReturnValues: "ALL_NEW",
        })
      );

      const count = result.Attributes?.count || 1;

      // Broadcast the new count to all WebSocket clients
      await broadcastCount(count);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ count }),
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};

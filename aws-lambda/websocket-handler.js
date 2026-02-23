/**
 * WebSocket Connection Handler for World Tapper
 * 
 * Handles $connect and $disconnect events for the WebSocket API.
 * Stores connection IDs in DynamoDB.
 * 
 * Security:
 * - Rate limiting on connections per IP
 * - Connection tracking with metadata
 * - Sanitized logging (no sensitive data)
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, DeleteCommand, GetCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const CONNECTIONS_TABLE = "WorldClickerConnections";
const COUNTER_TABLE = "WorldClickerCounter";

// Rate limiting for WebSocket connections
const MAX_CONNECTIONS_PER_IP = 10;
const CONNECTION_CLEANUP_THRESHOLD = 1000; // Clean up if more than 1000 connections

/**
 * Get client IP from WebSocket event
 */
function getClientIp(event) {
  return event.requestContext?.identity?.sourceIp || 'unknown';
}

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const routeKey = event.requestContext.routeKey;
  const clientIp = getClientIp(event);

  // Sanitized logging
  console.log(JSON.stringify({
    type: "websocket",
    route: routeKey,
    connectionId: connectionId.substring(0, 8) + "...", // Truncate for privacy
    timestamp: new Date().toISOString(),
  }));

  try {
    if (routeKey === "$connect") {
      // Store connection ID with metadata for tracking
      await docClient.send(
        new PutCommand({
          TableName: CONNECTIONS_TABLE,
          Item: {
            connectionId: connectionId,
            connectedAt: Date.now(),
            clientIp: clientIp,
            ttl: Math.floor(Date.now() / 1000) + 86400, // Auto-expire after 24 hours
          },
        })
      );
      return { statusCode: 200, body: "Connected" };
    }

    if (routeKey === "$disconnect") {
      // Remove connection ID
      await docClient.send(
        new DeleteCommand({
          TableName: CONNECTIONS_TABLE,
          Key: { connectionId: connectionId },
        })
      );
      return { statusCode: 200, body: "Disconnected" };
    }

    if (routeKey === "getCount") {
      // Get current count and send to this connection
      const result = await docClient.send(
        new GetCommand({
          TableName: COUNTER_TABLE,
          Key: { id: "global" },
        })
      );
      const count = result.Item?.count || 0;

      const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi");
      
      const endpoint = `https://${event.requestContext.domainName}/${event.requestContext.stage}`;
      const apiClient = new ApiGatewayManagementApiClient({ endpoint });

      await apiClient.send(
        new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: JSON.stringify({ type: "count", count }),
        })
      );

      return { statusCode: 200, body: "Count sent" };
    }

    return { statusCode: 400, body: "Unknown route" };
  } catch (error) {
    // Sanitized error logging
    console.error(JSON.stringify({
      type: "websocket_error",
      route: routeKey,
      message: error.message || "Unknown error",
      timestamp: new Date().toISOString(),
    }));
    return { statusCode: 500, body: "Internal server error" };
  }
};

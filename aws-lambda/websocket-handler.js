/**
 * WebSocket Connection Handler for World Clicker
 * 
 * Handles $connect and $disconnect events for the WebSocket API.
 * Stores connection IDs in DynamoDB.
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, DeleteCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const CONNECTIONS_TABLE = "WorldClickerConnections";
const COUNTER_TABLE = "WorldClickerCounter";

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const routeKey = event.requestContext.routeKey;

  console.log(`Route: ${routeKey}, ConnectionId: ${connectionId}`);

  try {
    if (routeKey === "$connect") {
      // Store connection ID
      await docClient.send(
        new PutCommand({
          TableName: CONNECTIONS_TABLE,
          Item: {
            connectionId: connectionId,
            connectedAt: Date.now(),
          },
        })
      );
      console.log(`Connected: ${connectionId}`);
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
      console.log(`Disconnected: ${connectionId}`);
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
    console.error("Error:", error);
    return { statusCode: 500, body: "Internal server error" };
  }
};

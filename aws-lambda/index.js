/**
 * AWS Lambda function for World Tapper
 * 
 * This function handles:
 * - GET /counter: Returns the current global click count
 * - POST /counter: Increments the click count (and user balance if userId provided)
 * - GET /user/{userId}: Get user data (balance, owned items)
 * - POST /store: Purchase an item
 * - GET /store/global: Get all globally owned auto-clickers
 * 
 * DynamoDB Tables:
 * - WorldClickerCounter: Global counter (id: "global", count: number)
 * - WorldClickerConnections: WebSocket connections
 * - WorldClickerUsers: User data (userId, balance, ownedItems, totalClicks)
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, UpdateCommand, ScanCommand, DeleteCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "WorldClickerCounter";
const CONNECTIONS_TABLE = "WorldClickerConnections";
const USERS_TABLE = "WorldClickerUsers";
const COUNTER_ID = "global";

// Store items configuration (must match frontend)
const STORE_ITEMS = {
  mouse: { basePrice: 15, clicksPerMinute: 0.5 },
  chicken: { basePrice: 50, clicksPerMinute: 1 },
  cow: { basePrice: 100, clicksPerMinute: 1 },
  robot: { basePrice: 250, clicksPerMinute: 2 },
  house: { basePrice: 1000, clicksPerMinute: 2 },
  factory: { basePrice: 5000, clicksPerMinute: 5 },
  rocket: { basePrice: 25000, clicksPerMinute: 10 },
  ufo: { basePrice: 100000, clicksPerMinute: 20 },
  star: { basePrice: 500000, clicksPerMinute: 50 },
  galaxy: { basePrice: 2000000, clicksPerMinute: 100 },
};

const PRICE_MULTIPLIER = 1.1;

// WebSocket API endpoint - will be set after creating the WebSocket API
const WS_ENDPOINT = process.env.WEBSOCKET_ENDPOINT;

// CORS headers for cross-origin requests
const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Calculate price based on owned count
function calculatePrice(itemId, ownedCount) {
  const item = STORE_ITEMS[itemId];
  if (!item) return null;
  return Math.floor(item.basePrice * Math.pow(PRICE_MULTIPLIER, ownedCount));
}

// Get or create user data
async function getOrCreateUser(userId) {
  const result = await docClient.send(
    new GetCommand({
      TableName: USERS_TABLE,
      Key: { odaUserId: userId },
    })
  );

  if (result.Item) {
    return result.Item;
  }

  // Create new user
  const newUser = {
    odaUserId: userId,
    balance: 0,
    ownedItems: {},
    totalClicks: 0,
    username: "",
    createdAt: Date.now(),
  };

  await docClient.send(
    new PutCommand({
      TableName: USERS_TABLE,
      Item: newUser,
    })
  );

  return newUser;
}

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
  const path = event.path || event.requestContext?.http?.path || "";

  try {
    // Handle CORS preflight
    if (httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers,
        body: "",
      };
    }

    // Route: GET /user/{userId} - Get user data
    if (httpMethod === "GET" && path.includes("/user/")) {
      const userId = path.split("/user/")[1];
      
      if (!userId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "User ID required" }),
        };
      }

      const user = await getOrCreateUser(userId);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(user),
      };
    }

    // Route: GET /store/global - Get all auto-clickers
    if (httpMethod === "GET" && path.includes("/store/global")) {
      const result = await docClient.send(
        new ScanCommand({ TableName: USERS_TABLE })
      );

      const items = [];
      (result.Items || []).forEach(user => {
        const ownedItems = user.ownedItems || {};
        Object.entries(ownedItems).forEach(([itemId, count]) => {
          for (let i = 0; i < count; i++) {
            items.push({
              itemId,
              userId: user.userId,
              username: user.username || "Anonymous",
            });
          }
        });
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ items }),
      };
    }

    // Route: POST /store - Purchase an item
    if (httpMethod === "POST" && path.includes("/store")) {
      const body = JSON.parse(event.body || "{}");
      const { userId, itemId } = body;

      if (!userId || !itemId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "userId and itemId required" }),
        };
      }

      if (!STORE_ITEMS[itemId]) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Invalid item" }),
        };
      }

      // Get user data
      const user = await getOrCreateUser(userId);
      const ownedCount = user.ownedItems?.[itemId] || 0;
      const price = calculatePrice(itemId, ownedCount);

      if (user.balance < price) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            success: false, 
            error: "Insufficient balance",
            newBalance: user.balance,
            ownedItems: user.ownedItems || {},
          }),
        };
      }

      // Update user: deduct balance and add item
      // First, ensure ownedItems exists as a map
      if (!user.ownedItems || Object.keys(user.ownedItems).length === 0) {
        await docClient.send(
          new UpdateCommand({
            TableName: USERS_TABLE,
            Key: { odaUserId: userId },
            UpdateExpression: "SET ownedItems = :emptyMap",
            ExpressionAttributeValues: { ":emptyMap": {} },
          })
        );
      }

      const updateResult = await docClient.send(
        new UpdateCommand({
          TableName: USERS_TABLE,
          Key: { odaUserId: userId },
          UpdateExpression: "SET balance = balance - :price, ownedItems.#itemId = if_not_exists(ownedItems.#itemId, :zero) + :one",
          ExpressionAttributeNames: { "#itemId": itemId },
          ExpressionAttributeValues: { 
            ":price": price, 
            ":zero": 0, 
            ":one": 1 
          },
          ReturnValues: "ALL_NEW",
        })
      );

      const updatedUser = updateResult.Attributes;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          newBalance: updatedUser.balance,
          ownedItems: updatedUser.ownedItems || {},
        }),
      };
    }

    // Route: GET /counter - Retrieve current count
    if (httpMethod === "GET" && (path.includes("/counter") || path === "" || path === "/")) {
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

    // Route: POST /counter - Increment counter (and user balance if userId provided)
    // Supports batching: { clicks: number } to add multiple clicks at once
    if (httpMethod === "POST" && (path.includes("/counter") || path === "" || path === "/")) {
      const body = JSON.parse(event.body || "{}");
      const { userId, clicks = 1 } = body;
      
      // Validate clicks - must be positive integer, cap at 10000 per request
      const clickCount = Math.min(Math.max(1, Math.floor(Number(clicks) || 1)), 10000);

      // Increment global counter
      const result = await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { id: COUNTER_ID },
          UpdateExpression: "SET #count = if_not_exists(#count, :zero) + :inc",
          ExpressionAttributeNames: { "#count": "count" },
          ExpressionAttributeValues: { ":zero": 0, ":inc": clickCount },
          ReturnValues: "ALL_NEW",
        })
      );

      const count = result.Attributes?.count || clickCount;

      // If userId provided, also increment user's balance and totalClicks
      let userBalance = null;
      if (userId) {
        const userResult = await docClient.send(
          new UpdateCommand({
            TableName: USERS_TABLE,
            Key: { odaUserId: userId },
            UpdateExpression: "SET balance = if_not_exists(balance, :zero) + :inc, totalClicks = if_not_exists(totalClicks, :zero) + :inc",
            ExpressionAttributeValues: { ":zero": 0, ":inc": clickCount },
            ReturnValues: "ALL_NEW",
          })
        );
        userBalance = userResult.Attributes?.balance;
      }

      // Broadcast the new count to all WebSocket clients
      await broadcastCount(count);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ count, userBalance }),
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

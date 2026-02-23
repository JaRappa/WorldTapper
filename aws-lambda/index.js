/**
 * AWS Lambda function for World Tapper
 * 
 * This function handles:
 * - GET /counter: Returns the current global click count
 * - POST /counter: Increments the click count (and user balance if userId provided)
 * - GET /user/{userId}: Get user data (balance, owned items) [AUTHENTICATED]
 * - POST /store: Purchase an item [AUTHENTICATED]
 * - GET /store/global: Get all globally owned auto-clickers
 * 
 * DynamoDB Tables:
 * - WorldClickerCounter: Global counter (id: "global", count: number)
 * - WorldClickerConnections: WebSocket connections
 * - WorldClickerUsers: User data (userId, balance, ownedItems, totalClicks)
 * 
 * Security:
 * - JWT tokens are verified using Cognito JWKS
 * - User ID is extracted from verified token claims (sub)
 * - Protected endpoints require valid authentication
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, UpdateCommand, ScanCommand, DeleteCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi");
const { CognitoIdentityProviderClient, ListUsersCommand } = require("@aws-sdk/client-cognito-identity-provider");
const crypto = require("crypto");

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

// ============================================================================
// CORS CONFIGURATION
// ============================================================================

// Allowed origins for CORS - configure based on environment
const ALLOWED_ORIGINS = [
  "https://worldtapper.com",
  "https://www.worldtapper.com",
  "https://worldclicker.com",
  "https://www.worldclicker.com",
  // Development origins
  "http://localhost:8081",
  "http://localhost:19000",
  "http://localhost:19006",
  "exp://localhost:8081",
  "exp://localhost:19000",
];

// Check if origin is allowed (also allow mobile apps which don't send origin)
function isOriginAllowed(origin) {
  if (!origin) return true; // Mobile apps don't send origin header
  return ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".expo.dev");
}

// Generate CORS headers with proper origin validation
function getCorsHeaders(origin) {
  const allowedOrigin = isOriginAllowed(origin) ? (origin || "*") : ALLOWED_ORIGINS[0];
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
  };
}

// Legacy headers object for backwards compatibility (will be replaced with dynamic headers)
const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// ============================================================================
// RATE LIMITING
// ============================================================================

// Simple in-memory rate limiting (resets on Lambda cold start)
// For production, consider using DynamoDB or ElastiCache for distributed rate limiting
const rateLimitCache = new Map();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute window
const RATE_LIMIT_MAX_REQUESTS = 100; // Max 100 requests per minute per IP
const RATE_LIMIT_MAX_CLICKS_PER_WINDOW = 1000; // Max 1000 clicks credited per minute per user

/**
 * Check rate limit for an identifier (IP or userId)
 * @param {string} identifier - IP address or user ID
 * @param {string} type - 'request' or 'clicks'
 * @param {number} amount - Amount to add (1 for requests, click count for clicks)
 * @returns {{allowed: boolean, remaining: number, resetIn: number}}
 */
function checkRateLimit(identifier, type = 'request', amount = 1) {
  const key = `${type}:${identifier}`;
  const now = Date.now();
  const maxLimit = type === 'clicks' ? RATE_LIMIT_MAX_CLICKS_PER_WINDOW : RATE_LIMIT_MAX_REQUESTS;
  
  let record = rateLimitCache.get(key);
  
  // Clean up expired records periodically
  if (rateLimitCache.size > 10000) {
    for (const [k, v] of rateLimitCache) {
      if (now - v.windowStart > RATE_LIMIT_WINDOW_MS) {
        rateLimitCache.delete(k);
      }
    }
  }
  
  if (!record || (now - record.windowStart) > RATE_LIMIT_WINDOW_MS) {
    // Start new window
    record = { count: 0, windowStart: now };
  }
  
  if (record.count + amount > maxLimit) {
    return {
      allowed: false,
      remaining: Math.max(0, maxLimit - record.count),
      resetIn: Math.ceil((record.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000),
    };
  }
  
  record.count += amount;
  rateLimitCache.set(key, record);
  
  return {
    allowed: true,
    remaining: maxLimit - record.count,
    resetIn: Math.ceil((record.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000),
  };
}

/**
 * Get client IP from Lambda event
 */
function getClientIp(event) {
  return event.requestContext?.identity?.sourceIp ||
         event.requestContext?.http?.sourceIp ||
         event.headers?.['X-Forwarded-For']?.split(',')[0]?.trim() ||
         'unknown';
}

// ============================================================================
// JWT VERIFICATION FOR COGNITO TOKENS
// ============================================================================

// Cache for JWKS keys (persists across Lambda invocations)
let jwksCache = null;
let jwksCacheTime = 0;
const JWKS_CACHE_TTL = 3600000; // 1 hour in milliseconds

const COGNITO_REGION = process.env.AWS_REGION || "us-east-1";
const COGNITO_USER_POOL_ID_ENV = process.env.COGNITO_USER_POOL_ID || "us-east-1_C8WRlcvHt";
const COGNITO_ISSUER = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID_ENV}`;
const JWKS_URL = `${COGNITO_ISSUER}/.well-known/jwks.json`;

/**
 * Fetches JWKS from Cognito (with caching)
 */
async function getJwks() {
  const now = Date.now();
  if (jwksCache && (now - jwksCacheTime) < JWKS_CACHE_TTL) {
    return jwksCache;
  }

  const https = require("https");
  return new Promise((resolve, reject) => {
    https.get(JWKS_URL, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          jwksCache = JSON.parse(data);
          jwksCacheTime = now;
          resolve(jwksCache);
        } catch (e) {
          reject(new Error("Failed to parse JWKS"));
        }
      });
    }).on("error", reject);
  });
}

/**
 * Base64URL decode helper
 */
function base64urlDecode(str) {
  // Add padding if needed
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) {
    str += "=";
  }
  return Buffer.from(str, "base64");
}

/**
 * Verifies a Cognito JWT token and returns the payload
 * @param {string} authHeader - The Authorization header value ("Bearer <token>")
 * @returns {Promise<{sub: string, email?: string, username?: string}>} - Verified token payload
 * @throws {Error} - If token is invalid or verification fails
 */
async function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization header");
  }

  const token = authHeader.replace("Bearer ", "");
  const parts = token.split(".");
  
  if (parts.length !== 3) {
    throw new Error("Invalid token format");
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  // Decode header and payload
  let header, payload;
  try {
    header = JSON.parse(base64urlDecode(headerB64).toString());
    payload = JSON.parse(base64urlDecode(payloadB64).toString());
  } catch (e) {
    throw new Error("Failed to decode token");
  }

  // Verify token claims
  const now = Math.floor(Date.now() / 1000);
  
  if (payload.exp && payload.exp < now) {
    throw new Error("Token has expired");
  }

  if (payload.iss !== COGNITO_ISSUER) {
    throw new Error("Invalid token issuer");
  }

  if (payload.token_use !== "id" && payload.token_use !== "access") {
    throw new Error("Invalid token use");
  }

  // Get the signing key from JWKS
  const jwks = await getJwks();
  const key = jwks.keys.find(k => k.kid === header.kid);
  
  if (!key) {
    throw new Error("Signing key not found");
  }

  // Use Node.js crypto.createPublicKey to import JWK directly (Node 16+)
  // This avoids manual PEM conversion which is error-prone
  const publicKey = crypto.createPublicKey({
    key: {
      kty: key.kty,
      n: key.n,
      e: key.e,
    },
    format: 'jwk',
  });

  const signatureInput = `${headerB64}.${payloadB64}`;
  const signature = base64urlDecode(signatureB64);

  const isValid = crypto.verify(
    "sha256",
    Buffer.from(signatureInput),
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    signature
  );

  if (!isValid) {
    throw new Error("Invalid token signature");
  }

  return payload;
}

/**
 * Extracts and verifies the user ID from the Authorization header
 * @param {object} event - The Lambda event object
 * @returns {Promise<string|null>} - The verified user ID (sub) or null if no auth
 */
async function getAuthenticatedUserId(event) {
  const authHeader = event.headers?.Authorization || event.headers?.authorization;
  if (!authHeader) {
    return null;
  }

  try {
    const payload = await verifyToken(authHeader);
    return payload.sub;
  } catch (e) {
    console.warn("Token verification failed:", e.message);
    return null;
  }
}

/**
 * Requires authentication and returns the verified user ID
 * @param {object} event - The Lambda event object
 * @returns {Promise<{userId: string}|{error: object}>} - User ID or error response
 */
async function requireAuth(event) {
  const authHeader = event.headers?.Authorization || event.headers?.authorization;
  
  if (!authHeader) {
    return {
      error: {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Authentication required" }),
      }
    };
  }

  try {
    const payload = await verifyToken(authHeader);
    return { userId: payload.sub };
  } catch (e) {
    console.warn("Token verification failed:", e.message);
    return {
      error: {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Invalid or expired token" }),
      }
    };
  }
}

/**
 * Validates that a string is a valid UUID format (Cognito sub)
 */
function isValidUUID(str) {
  if (!str || typeof str !== "string") return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Validates that an item ID is valid
 */
function isValidItemId(itemId) {
  return itemId && typeof itemId === "string" && STORE_ITEMS.hasOwnProperty(itemId);
}

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
  console.log("getCognitoUsername called with userId:", userId);
  const cognitoUsername = await getCognitoUsername(userId);
  const newUser = {
    odaUserId: userId,
    balance: 0,
    ownedItems: {},
    totalClicks: 0,
    username: cognitoUsername,
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

async function getCognitoUsername(userId) {
  console.log("getCognitoUsername called with userId (sub):", userId);
  try {
    // Use ListUsers with a filter on sub to find the user by their UUID
    const command = new ListUsersCommand({
      UserPoolId: COGNITO_USER_POOL_ID,
      Filter: `sub = "${userId}"`,
      Limit: 1,
    });
    const response = await cognitoClient.send(command);
    console.log("ListUsers response for", userId, JSON.stringify(response, null, 2));
    
    if (!response.Users || response.Users.length === 0) {
      console.log("No user found for sub:", userId);
      return "";
    }
    
    const cognitoUser = response.Users[0];
    let username = cognitoUser.Username; // This is the actual Cognito username
    
    // Also check for preferred_username attribute if set
    if (cognitoUser.Attributes) {
      const preferred = cognitoUser.Attributes.find(attr => attr.Name === "preferred_username");
      if (preferred && preferred.Value) {
        username = preferred.Value;
      }
    }
    
    console.log("Found username:", username, "for sub:", userId);
    return username || "";
  } catch (e) {
    console.log("ListUsers error for", userId, e);
    return "";
  }
}

const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || "us-east-1_C8WRlcvHt";
const cognitoClient = new CognitoIdentityProviderClient({ region: "us-east-1" });

exports.handler = async (event) => {
  // Sanitized logging - avoid logging sensitive data in production
  const httpMethod = event.httpMethod || event.requestContext?.http?.method;
  const path = event.path || event.requestContext?.http?.path || "";
  const clientIp = getClientIp(event);
  const origin = event.headers?.origin || event.headers?.Origin;
  
  // Use dynamic CORS headers based on origin
  const corsHeaders = getCorsHeaders(origin);
  
  console.log(JSON.stringify({
    type: "request",
    method: httpMethod,
    path: path,
    clientIp: clientIp,
    hasAuth: !!(event.headers?.Authorization || event.headers?.authorization),
    timestamp: new Date().toISOString(),
  }));

  try {
    // Rate limit by IP for all requests
    const ipRateLimit = checkRateLimit(clientIp, 'request', 1);
    if (!ipRateLimit.allowed) {
      console.log(JSON.stringify({ type: "rate_limit", clientIp, path }));
      return {
        statusCode: 429,
        headers: {
          ...corsHeaders,
          "Retry-After": String(ipRateLimit.resetIn),
        },
        body: JSON.stringify({ 
          error: "Too many requests", 
          retryAfter: ipRateLimit.resetIn 
        }),
      };
    }

    // Handle CORS preflight
    if (httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: "",
      };
    }

    // Route: GET /user/{userId} - Get user data [AUTHENTICATED]
    if (httpMethod === "GET" && path.includes("/user/")) {
      const requestedUserId = path.split("/user/")[1];
      
      if (!requestedUserId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "User ID required" }),
        };
      }

      // Validate userId format
      if (!isValidUUID(requestedUserId)) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Invalid user ID format" }),
        };
      }

      // Require authentication
      const auth = await requireAuth(event);
      if (auth.error) {
        // Add CORS headers to auth error response
        auth.error.headers = corsHeaders;
        return auth.error;
      }

      // Verify the authenticated user is requesting their own data (prevent IDOR)
      if (auth.userId !== requestedUserId) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Access denied: You can only access your own data" }),
        };
      }

      const user = await getOrCreateUser(auth.userId);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(user),
      };
    }

    // Route: GET /leaderboard - Get top players by total clicks
    if (httpMethod === "GET" && path.includes("/leaderboard")) {
      const result = await docClient.send(
        new ScanCommand({ TableName: USERS_TABLE })
      );

      // Filter out users with 0 clicks and sort by totalClicks descending
      const leaderboard = (result.Items || [])
        .filter(user => user.totalClicks > 0)
        .sort((a, b) => (b.totalClicks || 0) - (a.totalClicks || 0))
        .slice(0, 100) // Top 100 players
        .map(user => ({
          odaUserId: user.odaUserId,
          username: user.username || "Anonymous",
          totalClicks: user.totalClicks || 0,
          createdAt: user.createdAt || Date.now(),
        }));

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ leaderboard }),
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
        headers: corsHeaders,
        body: JSON.stringify({ items }),
      };
    }

    // Route: POST /store - Purchase an item [AUTHENTICATED]
    if (httpMethod === "POST" && path.includes("/store")) {
      // Require authentication first
      const auth = await requireAuth(event);
      if (auth.error) {
        // Add CORS headers to auth error response
        auth.error.headers = corsHeaders;
        return auth.error;
      }

      const body = JSON.parse(event.body || "{}");
      const { userId, itemId } = body;

      if (!itemId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "itemId required" }),
        };
      }

      // Validate itemId to prevent injection
      if (!isValidItemId(itemId)) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Invalid item" }),
        };
      }

      // If userId is provided in body, verify it matches the authenticated user (prevent IDOR)
      if (userId && userId !== auth.userId) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Access denied: You can only purchase for your own account" }),
        };
      }

      // Use the authenticated user's ID (ignore any userId in request body)
      const verifiedUserId = auth.userId;

      // Get user data
      const user = await getOrCreateUser(verifiedUserId);
      const ownedCount = user.ownedItems?.[itemId] || 0;
      const price = calculatePrice(itemId, ownedCount);

      if (user.balance < price) {
        return {
          statusCode: 400,
          headers: corsHeaders,
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
            Key: { odaUserId: verifiedUserId },
            UpdateExpression: "SET ownedItems = :emptyMap",
            ExpressionAttributeValues: { ":emptyMap": {} },
          })
        );
      }

      const updateResult = await docClient.send(
        new UpdateCommand({
          TableName: USERS_TABLE,
          Key: { odaUserId: verifiedUserId },
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
        headers: corsHeaders,
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
        headers: corsHeaders,
        body: JSON.stringify({ count }),
      };
    }

    // Route: POST /counter - Increment counter (and user balance if userId provided)
    // Supports batching: { clicks: number } to add multiple clicks at once
    // Note: User balance updates require valid authentication
    if (httpMethod === "POST" && (path.includes("/counter") || path === "" || path === "/")) {
      const body = JSON.parse(event.body || "{}");
      const { userId, clicks = 1 } = body;
      
      // Validate clicks - must be positive integer, cap at 10000 per request
      const clickCount = Math.min(Math.max(1, Math.floor(Number(clicks) || 1)), 10000);

      // Rate limit clicks per IP to prevent abuse
      const clickRateLimit = checkRateLimit(clientIp, 'clicks', clickCount);
      if (!clickRateLimit.allowed) {
        console.log(JSON.stringify({ type: "click_rate_limit", clientIp, clickCount }));
        return {
          statusCode: 429,
          headers: {
            ...corsHeaders,
            "Retry-After": String(clickRateLimit.resetIn),
          },
          body: JSON.stringify({ 
            error: "Click rate limit exceeded", 
            retryAfter: clickRateLimit.resetIn 
          }),
        };
      }

      // Increment global counter (unauthenticated - anyone can increment global count)
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

      // If userId provided, verify authentication before crediting user's balance
      let userBalance = null;
      if (userId) {
        // Validate userId format
        if (!isValidUUID(userId)) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: "Invalid userId format" }),
          };
        }

        // Get authenticated user ID from token
        const authenticatedUserId = await getAuthenticatedUserId(event);
        
        // Only credit balance if the authenticated user matches the requested userId
        if (authenticatedUserId && authenticatedUserId === userId) {
          // Additional rate limit on user balance credits
          const userClickLimit = checkRateLimit(authenticatedUserId, 'clicks', clickCount);
          if (userClickLimit.allowed) {
            const userResult = await docClient.send(
              new UpdateCommand({
                TableName: USERS_TABLE,
                Key: { odaUserId: authenticatedUserId },
                UpdateExpression: "SET balance = if_not_exists(balance, :zero) + :inc, totalClicks = if_not_exists(totalClicks, :zero) + :inc",
                ExpressionAttributeValues: { ":zero": 0, ":inc": clickCount },
                ReturnValues: "ALL_NEW",
              })
            );
            userBalance = userResult.Attributes?.balance;
          } else {
            console.log(JSON.stringify({ type: "user_click_rate_limit", userId: authenticatedUserId, clickCount }));
          }
        } else {
          // Log potential abuse attempt (userId provided but doesn't match token)
          console.log(JSON.stringify({ type: "click_credit_denied", requestedUserId: userId, hasAuth: !!authenticatedUserId }));
          // Still return success for the global counter, but don't credit user balance
        }
      }

      // Broadcast the new count to all WebSocket clients
      await broadcastCount(count);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ count, userBalance }),
      };
    }

    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  } catch (error) {
    // Sanitized error logging - don't expose stack traces
    console.error(JSON.stringify({
      type: "error",
      message: error.message || "Unknown error",
      path: path,
      method: httpMethod,
      timestamp: new Date().toISOString(),
    }));
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};

/**
 * AWS Lambda function for World Clicker
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
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "WorldClickerCounter";
const COUNTER_ID = "global";

// CORS headers for cross-origin requests
const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

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

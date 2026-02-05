# AWS Lambda Setup for World Tapper

This guide will help you set up the AWS Lambda function for the World Tapper global counter.

## Prerequisites

- AWS Account
- AWS CLI installed and configured

## Step 1: Create DynamoDB Table

1. Go to **AWS Console** > **DynamoDB**
2. Click **Create table**
3. Configure:
   - **Table name**: `WorldClickerCounter`
   - **Partition key**: `id` (String)
4. Click **Create table**

### Initialize the counter (optional):
After creating the table, you can add an initial item:
```json
{
  "id": "global",
  "count": 0
}
```

## Step 2: Create Lambda Function

1. Go to **AWS Console** > **Lambda**
2. Click **Create function**
3. Configure:
   - **Function name**: `WorldClickerCounter`
   - **Runtime**: `Node.js 20.x`
   - **Architecture**: `x86_64`
4. Click **Create function**
5. Copy the contents of `index.js` into the Lambda code editor
6. Click **Deploy**

## Step 3: Configure Lambda Permissions

The Lambda function needs permissions to access DynamoDB:

1. Go to your Lambda function's **Configuration** > **Permissions**
2. Click on the **Execution role**
3. Add an inline policy with:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:UpdateItem"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/WorldClickerCounter"
    }
  ]
}
```

## Step 4: Create API Gateway

1. Go to **AWS Console** > **API Gateway**
2. Click **Create API**
3. Choose **HTTP API** > **Build**
4. Configure:
   - **API name**: `WorldClickerAPI`
5. Add routes:
   - **GET** `/counter`
   - **POST** `/counter`
   - **OPTIONS** `/counter` (for CORS)
6. Integrate all routes with your Lambda function
7. Deploy to a stage (e.g., `prod`)

## Step 5: Update Frontend API URL

After deploying, you'll get an API endpoint URL like:
```
https://abc123.execute-api.us-east-1.amazonaws.com/prod/counter
```

Update this URL in `services/api.ts`:
```typescript
const API_URL = 'https://your-api-id.execute-api.region.amazonaws.com/prod/counter';
```

## Testing

### Get current count:
```bash
curl https://your-api-url/counter
```

### Increment count:
```bash
curl -X POST https://your-api-url/counter
```

## Costs

- **Lambda**: First 1M requests/month are free
- **DynamoDB**: First 25GB storage and 25 read/write capacity units are free
- **API Gateway**: First 1M API calls/month are free

This should be essentially free for a hobby project!

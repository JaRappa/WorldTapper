# Cognito Setup Guide for World Tapper

This guide explains how to set up Amazon Cognito for user authentication in World Tapper.

## 1. Create a Cognito User Pool

1. Go to the [AWS Cognito Console](https://console.aws.amazon.com/cognito)
2. Click **Create user pool**
3. Configure sign-in experience:
   - Select **Email** as the sign-in option
   - Click **Next**

4. Configure security requirements:
   - Password policy: Choose your requirements (min 8 characters recommended)
   - MFA: Optional (can be disabled for simpler UX)
   - Click **Next**

5. Configure sign-up experience:
   - Enable **Self-service sign-up**
   - Required attributes: **email**
   - Optional attributes: **preferred_username** (for display name)
   - Click **Next**

6. Configure message delivery:
   - Select **Send email with Cognito** (for simple setup)
   - Click **Next**

7. Integrate your app:
   - User pool name: `WorldTapperUserPool`
   - App client name: `WorldTapperApp`
   - **Important**: Uncheck "Generate a client secret" (not needed for public apps)
   - Click **Next**

8. Review and create

## 2. Get Your Credentials

After creating the user pool:

1. Go to your user pool
2. Copy the **User Pool ID** (format: `us-east-1_XXXXXXXXX`)
3. Go to **App integration** → **App clients**
4. Copy the **Client ID**

## 3. Update the App Configuration

Edit `services/auth.ts` and replace the placeholder values:

```typescript
const COGNITO_USER_POOL_ID = 'us-east-1_XXXXXXXXX'; // Your User Pool ID
const COGNITO_CLIENT_ID = 'xxxxxxxxxxxxxxxxxxxxxxxxxx'; // Your App Client ID
```

## 4. Create the Users DynamoDB Table

Create a new DynamoDB table for user data:

```bash
aws dynamodb create-table \
  --table-name WorldClickerUsers \
  --attribute-definitions AttributeName=userId,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

## 5. Update API Gateway Routes

Add the following routes to your API Gateway:

| Method | Path | Description |
|--------|------|-------------|
| GET | /user/{userId} | Get user data |
| POST | /store | Purchase an item |
| GET | /store/global | Get all global auto-clickers |

## 6. Update Lambda IAM Permissions

Add permissions for the new DynamoDB table in your Lambda execution role:

```json
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:GetItem",
    "dynamodb:PutItem",
    "dynamodb:UpdateItem",
    "dynamodb:Scan"
  ],
  "Resource": "arn:aws:dynamodb:us-east-1:YOUR_ACCOUNT:table/WorldClickerUsers"
}
```

## 7. Optional: Add Cognito Authorizer to API Gateway

For additional security, you can add a Cognito authorizer to protect the user and store endpoints:

1. In API Gateway, go to **Authorizers**
2. Create a new **Cognito** authorizer
3. Select your User Pool
4. Apply to the `/user/*` and `/store` routes

## Store Items

The app includes these purchasable auto-clickers:

| Item | Base Price | Clicks/Min | Emoji |
|------|------------|------------|-------|
| Mouse | 15 | 0.5 | 🐭 |
| Chicken | 50 | 1 | 🐔 |
| Cow | 100 | 1 | 🐄 |
| Robot | 250 | 2 | 🤖 |
| House | 1,000 | 2 | 🏠 |
| Factory | 5,000 | 5 | 🏭 |
| Rocket | 25,000 | 10 | 🚀 |
| UFO | 100,000 | 20 | 🛸 |
| Star | 500,000 | 50 | ⭐ |
| Galaxy | 2,000,000 | 100 | 🌌 |

Each purchase increases the item's price by 10%.

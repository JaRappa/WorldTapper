# 🌍 WorldTapper 🌍

[![Expo](https://img.shields.io/badge/Expo-SDK%2054-000020?logo=expo&logoColor=white)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.81-61DAFB?logo=react&logoColor=black)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![AWS Lambda](https://img.shields.io/badge/AWS-Lambda-FF9900?logo=amazonaws&logoColor=white)](https://aws.amazon.com/lambda/)
[![WebSocket](https://img.shields.io/badge/Real--time-WebSocket-1F2937)](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
[![Live Demo](https://img.shields.io/badge/%F0%9F%8C%8D%20Live%20Demo-worldtapper.com-22C55E)](https://www.worldtapper.com)

A real-time global counter product you can tap from anywhere, built as a full-stack mobile app.

## Overview

WorldTapper is a cross-platform mobile application that maintains a synchronized global counter across all connected users in real-time. Users can tap to increment the counter, and all changes are immediately broadcasted to every active client through WebSocket connections.

## Technical Architecture

### Frontend
- **React Native** with **Expo** for cross-platform iOS, Android, and web support
- **TypeScript** for type-safe development
- **Expo Router** for file-based navigation
- **React Native Reanimated** for smooth animations
- **Expo Haptics** for tactile feedback

### Backend
- **AWS Lambda** serverless functions for scalable API endpoints
- **AWS API Gateway** for REST API and WebSocket management
- **AWS DynamoDB** for persistent data storage
- Real-time WebSocket broadcasting for instant updates across clients

### Key Features
- ✅ Real-time synchronization across all connected clients
- ✅ Optimistic UI updates for instant feedback
- ✅ Automatic reconnection and error handling
- ✅ Haptic feedback on interactions
- ✅ Serverless architecture for high scalability
- ✅ Cross-platform support (iOS, Android, Web)

## Technical Highlights

- **WebSocket Management**: Custom WebSocket manager with automatic reconnection, exponential backoff, and connection pooling
- **State Management**: Efficient React hooks with optimistic updates and conflict resolution
- **Cloud Infrastructure**: Full AWS serverless stack with Lambda, API Gateway, and DynamoDB
- **Type Safety**: Complete TypeScript implementation with strict type checking
- **Performance**: Optimized rendering with debouncing and memoization patterns

## Project Structure

```
├── app/                    # React Native app screens
│   └── (tabs)/            # Tab-based navigation
├── components/            # Reusable UI components
├── services/              # API and WebSocket services
├── aws-lambda/            # Backend Lambda functions
├── hooks/                 # Custom React hooks
└── constants/             # Theme and configuration
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo CLI
- AWS Account (for backend deployment)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npx expo start
```

3. Run on your preferred platform:
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Press `w` for web browser
   - Scan QR code with Expo Go app

### Backend Setup

See [aws-lambda/README.md](aws-lambda/README.md) for detailed instructions on deploying the AWS infrastructure.

## Development

```bash
# Start development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android

# Run on web
npm run web

# Lint code
npm run lint
```

## Technologies Used

**Frontend:**
- React Native 0.81
- Expo SDK 54
- TypeScript 5.9
- React Navigation 7
- Expo Haptics

**Backend:**
- AWS Lambda (Node.js 20.x)
- AWS API Gateway
- AWS DynamoDB
- WebSocket API

**DevOps:**
- ESLint
- TypeScript strict mode
- Git version control

## License

Private project

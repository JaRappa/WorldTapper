/**
 * Authentication Service using Amazon Cognito
 * 
 * Handles user sign up, sign in, sign out, and session management.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    AuthenticationDetails,
    CognitoUser,
    CognitoUserAttribute,
    CognitoUserPool,
    CognitoUserSession,
} from 'amazon-cognito-identity-js';

// Cognito User Pool Configuration
const COGNITO_USER_POOL_ID = 'us-east-1_C8WRlcvHt';
const COGNITO_CLIENT_ID = '67pqn4aprvfq2e07nl03cg1o1f';

// Memory cache for synchronous access (required by Cognito SDK)
const memoryStorage: Record<string, string> = {};

// Sync storage adapter that Cognito expects
const cognitoStorage = {
  setItem: (key: string, value: string) => {
    memoryStorage[key] = value;
    // Also persist to AsyncStorage in background
    AsyncStorage.setItem(key, value).catch(console.error);
    return value;
  },
  getItem: (key: string) => {
    return memoryStorage[key] || null;
  },
  removeItem: (key: string) => {
    delete memoryStorage[key];
    AsyncStorage.removeItem(key).catch(console.error);
  },
  clear: () => {
    Object.keys(memoryStorage).forEach(key => delete memoryStorage[key]);
    AsyncStorage.clear().catch(console.error);
  },
};

// Initialize memory cache from AsyncStorage
async function initializeStorage() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cognitoKeys = keys.filter(k => k.startsWith('CognitoIdentityServiceProvider'));
    for (const key of cognitoKeys) {
      const value = await AsyncStorage.getItem(key);
      if (value) memoryStorage[key] = value;
    }
  } catch (e) {
    console.error('Failed to initialize auth storage:', e);
  }
}

// Start loading storage immediately
const storageReady = initializeStorage();

const poolData = {
  UserPoolId: COGNITO_USER_POOL_ID,
  ClientId: COGNITO_CLIENT_ID,
  Storage: cognitoStorage,
};

const userPool = new CognitoUserPool(poolData);

export interface AuthUser {
  username: string;
  email: string;
  sub: string; // Cognito user ID
}

export interface SignUpResult {
  userConfirmed: boolean;
  username: string;
}

/**
 * Sign up a new user
 */
export function signUp(email: string, password: string, username: string): Promise<SignUpResult> {
  return new Promise((resolve, reject) => {
    const attributeList = [
      new CognitoUserAttribute({ Name: 'email', Value: email }),
    ];

    // Use the username (not email) as the Cognito username since pool is configured for email alias
    userPool.signUp(username, password, attributeList, [], (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      if (result) {
        resolve({
          userConfirmed: result.userConfirmed,
          username: result.user.getUsername(),
        });
      }
    });
  });
}

/**
 * Confirm sign up with verification code
 * @param username - The username used during sign up (or email if pool allows)
 */
export function confirmSignUp(username: string, code: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({
      Username: username,
      Pool: userPool,
    });

    cognitoUser.confirmRegistration(code, true, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

/**
 * Sign in an existing user
 * @param usernameOrEmail - Username or email (Cognito allows either with email alias)
 * @returns The authenticated user info
 */
export function signIn(usernameOrEmail: string, password: string): Promise<AuthUser> {
  return new Promise((resolve, reject) => {
    const authenticationDetails = new AuthenticationDetails({
      Username: usernameOrEmail,
      Password: password,
    });

    const cognitoUser = new CognitoUser({
      Username: usernameOrEmail,
      Pool: userPool,
      Storage: cognitoStorage,
    });

    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: (session) => {
        // Get user attributes after successful auth
        cognitoUser.getUserAttributes((err, attributes) => {
          if (err || !attributes) {
            // Fallback: use basic info from session
            const payload = session.getIdToken().decodePayload();
            resolve({
              username: payload['cognito:username'] || usernameOrEmail,
              email: payload['email'] || '',
              sub: payload['sub'] || '',
            });
            return;
          }

          const user: AuthUser = {
            username: '',
            email: '',
            sub: '',
          };

          attributes.forEach((attr) => {
            if (attr.getName() === 'email') {
              user.email = attr.getValue();
            }
            if (attr.getName() === 'sub') {
              user.sub = attr.getValue();
            }
          });

          // Use cognito username
          user.username = cognitoUser.getUsername();
          if (!user.username) {
            user.username = user.email.split('@')[0];
          }

          resolve(user);
        });
      },
      onFailure: (err) => {
        reject(err);
      },
    });
  });
}

/**
 * Sign out the current user
 */
export function signOut(): Promise<void> {
  return new Promise((resolve) => {
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.signOut();
    }
    resolve();
  });
}

/**
 * Get the current authenticated user
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  // Make sure storage is loaded first
  await storageReady;
  
  return new Promise((resolve) => {
    const cognitoUser = userPool.getCurrentUser();
    
    if (!cognitoUser) {
      resolve(null);
      return;
    }

    cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session || !session.isValid()) {
        resolve(null);
        return;
      }

      cognitoUser.getUserAttributes((err, attributes) => {
        if (err || !attributes) {
          resolve(null);
          return;
        }

        const user: AuthUser = {
          username: '',
          email: '',
          sub: '',
        };

        attributes.forEach((attr) => {
          if (attr.getName() === 'email') {
            user.email = attr.getValue();
          }
          if (attr.getName() === 'preferred_username') {
            user.username = attr.getValue();
          }
          if (attr.getName() === 'sub') {
            user.sub = attr.getValue();
          }
        });

        // Use email as username if preferred_username is not set
        if (!user.username) {
          user.username = user.email.split('@')[0];
        }

        resolve(user);
      });
    });
  });
}

/**
 * Get the current session's ID token
 */
export async function getIdToken(): Promise<string | null> {
  // Make sure storage is loaded first
  await storageReady;
  
  return new Promise((resolve) => {
    const cognitoUser = userPool.getCurrentUser();
    
    if (!cognitoUser) {
      resolve(null);
      return;
    }

    cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session || !session.isValid()) {
        resolve(null);
        return;
      }

      resolve(session.getIdToken().getJwtToken());
    });
  });
}

/**
 * Resend confirmation code
 */
export function resendConfirmationCode(email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool,
    });

    cognitoUser.resendConfirmationCode((err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

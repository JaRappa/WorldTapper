/**
 * API Service for World Tapper
 * 
 * Handles communication with the AWS Lambda backend
 * for the global click counter, user data, and store purchases.
 * 
 * Security Note: API URLs are loaded from environment configuration.
 * All authenticated endpoints use JWT tokens validated server-side.
 */

import Constants from 'expo-constants';
import { getIdToken } from './auth';

// AWS API Gateway URLs - loaded from app.json extra config or fall back to defaults
const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl ?? 'https://rdbffoe73a.execute-api.us-east-1.amazonaws.com/prod';
const WS_BASE_URL = Constants.expoConfig?.extra?.wsBaseUrl ?? 'wss://jo6m4amkee.execute-api.us-east-1.amazonaws.com/prod';

const API_URL = `${API_BASE_URL}/counter`;
const USER_API_URL = `${API_BASE_URL}/user`;
const STORE_API_URL = `${API_BASE_URL}/store`;
const LEADERBOARD_API_URL = `${API_BASE_URL}/leaderboard`;
const WS_URL = WS_BASE_URL;

// For local testing without AWS, use this mock:
const USE_MOCK = false; // Set to true for local testing without AWS
let mockCount = 0;
let mockUserData: UserData | null = null;

export interface CounterResponse {
  count: number;
}

export interface UserData {
  odaUserId: string;
  balance: number;
  ownedItems: Record<string, number>; // { itemId: count }
  totalClicks: number;
  username: string;
}

export interface GlobalAutoClickers {
  items: Array<{
    itemId: string;
    userId: string;
    username: string;
  }>;
}

export interface PurchaseResult {
  success: boolean;
  newBalance: number;
  ownedItems: Record<string, number>;
  error?: string;
}

export interface LeaderboardEntry {
  odaUserId: string;
  username: string;
  totalClicks: number;
  createdAt: number;
}

// WebSocket connection management
type CountUpdateCallback = (count: number) => void;

class WebSocketManager {
  private ws: WebSocket | null = null;
  private callbacks: Set<CountUpdateCallback> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'count' && typeof data.count === 'number') {
            this.callbacks.forEach(cb => cb(data.count));
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket closed');
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        // Silently handle WebSocket errors - they're common on iOS/Expo Go
        // The app will still work via HTTP polling
      };
    } catch (error) {
      // Silently fail - WebSocket is optional enhancement
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => this.connect(), delay);
  }

  subscribe(callback: CountUpdateCallback) {
    this.callbacks.add(callback);
    this.connect(); // Ensure connected when subscribing
    return () => this.callbacks.delete(callback);
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }
}

export const wsManager = new WebSocketManager();

/**
 * Fetches the current global click count
 */
export async function getClickCount(): Promise<CounterResponse> {
  if (USE_MOCK) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
    return { count: mockCount };
  }

  try {
    const response = await fetch(API_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to get click count:', error);
    throw error;
  }
}

/**
 * Increments the global click count and returns the new value
 * If userId is provided, also increments the user's balance
 * @param userId - Optional user ID to also credit clicks to their balance
 * @param clicks - Number of clicks to add (default 1, used for batching auto-clicks)
 */
export async function incrementClickCount(userId?: string, clicks: number = 1): Promise<CounterResponse & { userBalance?: number }> {
  if (USE_MOCK) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 50));
    mockCount += clicks;
    if (userId && mockUserData) {
      mockUserData.balance += clicks;
      mockUserData.totalClicks += clicks;
      return { count: mockCount, userBalance: mockUserData.balance };
    }
    return { count: mockCount };
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Add auth token if user is signed in (but don't fail if token retrieval fails)
    if (userId) {
      try {
        const token = await getIdToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (tokenError) {
        console.warn('Failed to get auth token, proceeding without auth:', tokenError);
      }
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId, clicks }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error response:', response.status, errorText);
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to increment click count:', error);
    throw error;
  }
}

/**
 * Get user data (balance, owned items, etc.)
 */
export async function getUserData(userId: string): Promise<UserData> {
  if (USE_MOCK) {
    await new Promise(resolve => setTimeout(resolve, 100));
    if (!mockUserData) {
      mockUserData = {
        odaUserId: userId,
        balance: 0,
        ownedItems: {},
        totalClicks: 0,
        username: 'MockUser',
      };
    }
    return mockUserData;
  }

  try {
    const token = await getIdToken();
    const response = await fetch(`${USER_API_URL}/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to get user data:', error);
    throw error;
  }
}

/**
 * Purchase an item from the store
 */
export async function purchaseItem(userId: string, itemId: string): Promise<PurchaseResult> {
  if (USE_MOCK) {
    await new Promise(resolve => setTimeout(resolve, 100));
    if (mockUserData) {
      // Simple mock logic
      mockUserData.ownedItems[itemId] = (mockUserData.ownedItems[itemId] || 0) + 1;
      return {
        success: true,
        newBalance: mockUserData.balance,
        ownedItems: mockUserData.ownedItems,
      };
    }
    return { success: false, newBalance: 0, ownedItems: {}, error: 'Not signed in' };
  }

  try {
    const token = await getIdToken();
    const response = await fetch(STORE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ userId, itemId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { 
        success: false, 
        newBalance: 0, 
        ownedItems: {}, 
        error: errorData.error || 'Purchase failed' 
      };
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to purchase item:', error);
    throw error;
  }
}

/**
 * Get all auto-clickers owned by all users (for displaying on the world)
 */
export async function getGlobalAutoClickers(): Promise<GlobalAutoClickers> {
  if (USE_MOCK) {
    await new Promise(resolve => setTimeout(resolve, 100));
    return { items: [] };
  }

  try {
    const response = await fetch(`${STORE_API_URL}/global`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to get global auto-clickers:', error);
    throw error;
  }
}

/**
 * Get the leaderboard (top players by total clicks)
 */
export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  if (USE_MOCK) {
    await new Promise(resolve => setTimeout(resolve, 100));
    return [];
  }

  try {
    const response = await fetch(LEADERBOARD_API_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.leaderboard || [];
  } catch (error) {
    console.error('Failed to get leaderboard:', error);
    throw error;
  }
}

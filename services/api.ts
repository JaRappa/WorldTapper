/**
 * API Service for World Clicker
 * 
 * Handles communication with the AWS Lambda backend
 * for the global click counter.
 */

// AWS API Gateway URLs
const API_URL = 'https://rdbffoe73a.execute-api.us-east-1.amazonaws.com/prod/counter';
const WS_URL = 'wss://jo6m4amkee.execute-api.us-east-1.amazonaws.com/prod';

// For local testing without AWS, use this mock:
const USE_MOCK = false; // Set to true for local testing without AWS
let mockCount = 0;

export interface CounterResponse {
  count: number;
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

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
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
 */
export async function incrementClickCount(): Promise<CounterResponse> {
  if (USE_MOCK) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 50));
    mockCount += 1;
    return { count: mockCount };
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to increment click count:', error);
    throw error;
  }
}

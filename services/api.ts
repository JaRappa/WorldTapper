/**
 * API Service for World Clicker
 * 
 * Handles communication with the AWS Lambda backend
 * for the global click counter.
 */

// TODO: Replace with your actual AWS API Gateway URL after deploying
const API_URL = 'https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com/prod/counter';

// For local testing without AWS, use this mock:
const USE_MOCK = true; // Set to false when AWS is configured
let mockCount = 0;

export interface CounterResponse {
  count: number;
}

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

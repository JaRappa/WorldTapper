/**
 * Store Items Configuration
 * 
 * Defines all purchasable auto-clicker items with their properties.
 */

export interface StoreItem {
  id: string;
  emoji: string;
  name: string;
  description: string;
  basePrice: number;
  clicksPerMinute: number; // How many clicks per minute this item generates
  priceMultiplier: number; // Price increases by this factor per purchase (1.1 = 10%)
}

export const STORE_ITEMS: StoreItem[] = [
  {
    id: 'mouse',
    emoji: '🐭',
    name: 'Mouse',
    description: 'A tiny helper that clicks once every 2 minutes',
    basePrice: 15,
    clicksPerMinute: 0.5,
    priceMultiplier: 1.1,
  },
  {
    id: 'chicken',
    emoji: '🐔',
    name: 'Chicken',
    description: 'Pecks the earth once per minute',
    basePrice: 50,
    clicksPerMinute: 1,
    priceMultiplier: 1.1,
  },
  {
    id: 'cow',
    emoji: '🐄',
    name: 'Cow',
    description: 'A sturdy cow that clicks once per minute',
    basePrice: 100,
    clicksPerMinute: 1,
    priceMultiplier: 1.1,
  },
  {
    id: 'robot',
    emoji: '🤖',
    name: 'Robot',
    description: 'Efficiently clicks twice per minute',
    basePrice: 250,
    clicksPerMinute: 2,
    priceMultiplier: 1.1,
  },
  {
    id: 'house',
    emoji: '🏠',
    name: 'House',
    description: 'A clicking house - 2 clicks per minute!',
    basePrice: 1000,
    clicksPerMinute: 2,
    priceMultiplier: 1.1,
  },
  {
    id: 'factory',
    emoji: '🏭',
    name: 'Factory',
    description: 'Industrial clicking - 5 clicks per minute',
    basePrice: 5000,
    clicksPerMinute: 5,
    priceMultiplier: 1.1,
  },
  {
    id: 'rocket',
    emoji: '🚀',
    name: 'Rocket',
    description: 'Blasts out 10 clicks per minute',
    basePrice: 25000,
    clicksPerMinute: 10,
    priceMultiplier: 1.1,
  },
  {
    id: 'ufo',
    emoji: '🛸',
    name: 'UFO',
    description: 'Alien technology - 20 clicks per minute',
    basePrice: 100000,
    clicksPerMinute: 20,
    priceMultiplier: 1.1,
  },
  {
    id: 'star',
    emoji: '⭐',
    name: 'Star',
    description: 'Cosmic power - 50 clicks per minute',
    basePrice: 500000,
    clicksPerMinute: 50,
    priceMultiplier: 1.1,
  },
  {
    id: 'galaxy',
    emoji: '🌌',
    name: 'Galaxy',
    description: 'Ultimate power - 100 clicks per minute!',
    basePrice: 2000000,
    clicksPerMinute: 100,
    priceMultiplier: 1.1,
  },
];

/**
 * Calculate the price of an item based on how many the user already owns
 */
export function calculatePrice(item: StoreItem, ownedCount: number): number {
  return Math.floor(item.basePrice * Math.pow(item.priceMultiplier, ownedCount));
}

/**
 * Get a store item by ID
 */
export function getStoreItem(id: string): StoreItem | undefined {
  return STORE_ITEMS.find(item => item.id === id);
}

/**
 * Calculate total clicks per minute from owned items
 */
export function calculateTotalClicksPerMinute(ownedItems: Record<string, number>): number {
  return STORE_ITEMS.reduce((total, item) => {
    const count = ownedItems[item.id] || 0;
    return total + (item.clicksPerMinute * count);
  }, 0);
}

/**
 * Format clicks per minute for display (e.g., "1/2 min" instead of "0.5/min")
 */
export function formatClicksPerMinute(clicksPerMinute: number): string {
  if (clicksPerMinute >= 1) {
    return `${clicksPerMinute}/min`;
  } else if (clicksPerMinute === 0.5) {
    return '1/2 min';
  } else if (clicksPerMinute === 0.25) {
    return '1/4 min';
  } else {
    // For other fractions, show as "1 per X min"
    const minutesPerClick = 1 / clicksPerMinute;
    return `1/${minutesPerClick} min`;
  }
}

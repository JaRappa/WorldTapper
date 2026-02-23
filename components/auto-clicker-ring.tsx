/**
 * Auto-Clicker Ring Component
 * 
 * Displays purchased auto-clickers in a ring around the world emoji.
 * Items animate (pulse in/out) when they click.
 * 
 * COST OPTIMIZATION: Clicks are accumulated locally and batched.
 * The onBatchClick callback is called every BATCH_INTERVAL_MS with total accumulated clicks.
 * This reduces API calls from potentially thousands per minute to just 2 per minute.
 */

import { STORE_ITEMS, StoreItem, calculateTotalClicksPerMinute } from '@/constants/store-items';
import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

// Batch clicks every 30 seconds to minimize API calls
const BATCH_INTERVAL_MS = 30000;

interface AutoClickerRingProps {
  ownedItems: Record<string, number>; // { itemId: count }
  worldSize: number; // Size of the world emoji to orbit around
  onBatchClick?: (totalClicks: number) => void; // Called every 30s with accumulated clicks
  onLocalClick?: (clicks: number) => void; // Called for UI updates (no API call)
}

interface OrbitingItem {
  id: string;
  item: StoreItem;
  index: number; // Position in the ring
  totalInRing: number;
}

const AnimatedEmoji = ({ 
  item, 
  angle, 
  radius, 
  clickInterval 
}: { 
  item: StoreItem; 
  angle: number; 
  radius: number; 
  clickInterval: number;
}) => {
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  // Calculate position on the ring
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  
  useEffect(() => {
    // Pulse animation that repeats based on click interval
    // clicksPerMinute -> interval in ms
    const intervalMs = (60 / item.clicksPerMinute) * 1000;
    
    // Create pulse animation
    scale.value = withRepeat(
      withSequence(
        withTiming(1.3, { duration: 150, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 150, easing: Easing.in(Easing.quad) }),
        withDelay(intervalMs - 300, withTiming(1, { duration: 0 }))
      ),
      -1,
      false
    );
    
    // Move toward center when clicking
    translateX.value = withRepeat(
      withSequence(
        withTiming(-x * 0.15, { duration: 150, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 150, easing: Easing.in(Easing.quad) }),
        withDelay(intervalMs - 300, withTiming(0, { duration: 0 }))
      ),
      -1,
      false
    );
    
    translateY.value = withRepeat(
      withSequence(
        withTiming(-y * 0.15, { duration: 150, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 150, easing: Easing.in(Easing.quad) }),
        withDelay(intervalMs - 300, withTiming(0, { duration: 0 }))
      ),
      -1,
      false
    );
  }, [item.clicksPerMinute, x, y]);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x + translateX.value },
      { translateY: y + translateY.value },
      { scale: scale.value },
    ],
  }));
  
  return (
    <Animated.Text style={[styles.orbitingEmoji, animatedStyle]}>
      {item.emoji}
    </Animated.Text>
  );
};

export function AutoClickerRing({ ownedItems, worldSize, onBatchClick, onLocalClick }: AutoClickerRingProps) {
  const accumulatedClicks = useRef(0);
  const batchTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const localTickTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Calculate total clicks per minute for local tick simulation
  const totalClicksPerMinute = useMemo(() => 
    calculateTotalClicksPerMinute(ownedItems), [ownedItems]);
  
  // Create list of all individual items to display
  const orbitingItems = useMemo(() => {
    const items: OrbitingItem[] = [];
    let index = 0;
    
    // First, count total items
    let total = 0;
    STORE_ITEMS.forEach(storeItem => {
      const count = ownedItems[storeItem.id] || 0;
      total += count;
    });
    
    // Now create individual items
    STORE_ITEMS.forEach(storeItem => {
      const count = ownedItems[storeItem.id] || 0;
      for (let i = 0; i < count; i++) {
        items.push({
          id: `${storeItem.id}-${i}`,
          item: storeItem,
          index: index++,
          totalInRing: total,
        });
      }
    });
    
    return items;
  }, [ownedItems]);
  
  // Local tick for UI updates (no API calls)
  // This updates the displayed count locally for smooth UX
  useEffect(() => {
    if (totalClicksPerMinute <= 0) return;
    
    // Calculate interval: how often we get 1 click
    const msPerClick = (60 * 1000) / totalClicksPerMinute;
    
    localTickTimer.current = setInterval(() => {
      accumulatedClicks.current += 1;
      onLocalClick?.(1);
    }, msPerClick);
    
    return () => {
      if (localTickTimer.current) {
        clearInterval(localTickTimer.current);
      }
    };
  }, [totalClicksPerMinute, onLocalClick]);
  
  // Batch API call timer - sends accumulated clicks every 30 seconds
  useEffect(() => {
    if (!onBatchClick || totalClicksPerMinute <= 0) return;
    
    batchTimer.current = setInterval(() => {
      const clicks = accumulatedClicks.current;
      if (clicks > 0) {
        accumulatedClicks.current = 0;
        onBatchClick(clicks);
      }
    }, BATCH_INTERVAL_MS);
    
    return () => {
      // Send any remaining clicks when unmounting
      if (accumulatedClicks.current > 0 && onBatchClick) {
        onBatchClick(accumulatedClicks.current);
        accumulatedClicks.current = 0;
      }
      if (batchTimer.current) {
        clearInterval(batchTimer.current);
      }
    };
  }, [onBatchClick, totalClicksPerMinute]);
  
  if (orbitingItems.length === 0) {
    return null;
  }
  
  // Calculate ring radius based on world size
  const baseRadius = worldSize / 2 + 30;
  const emojiSize = 24; // Size of emoji
  const itemsPerRing = 250; // Max items per ring before starting a new ring
  
  return (
    <View style={[styles.container, { width: worldSize + 200, height: worldSize + 200 }]}>
      {orbitingItems.map((orbiting, idx) => {
        // Calculate which ring this item is on (250 items per ring)
        const ringIndex = Math.floor(idx / itemsPerRing);
        const positionInRing = idx % itemsPerRing;
        const itemsInThisRing = Math.min(itemsPerRing, orbitingItems.length - ringIndex * itemsPerRing);
        
        // Calculate angle for this position - items evenly distributed, will overlap when many
        const angle = (positionInRing / itemsInThisRing) * Math.PI * 2 - Math.PI / 2;
        // Each ring is 1 emoji width (24px) apart
        const radius = baseRadius + ringIndex * emojiSize;
        
        return (
          <View 
            key={orbiting.id} 
            style={[styles.emojiContainer, { left: '50%', top: '50%' }]}
          >
            <AnimatedEmoji
              item={orbiting.item}
              angle={angle}
              radius={radius}
              clickInterval={(60 / orbiting.item.clicksPerMinute) * 1000}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiContainer: {
    position: 'absolute',
  },
  orbitingEmoji: {
    fontSize: 24,
    position: 'absolute',
    marginLeft: -12,
    marginTop: -12,
  },
});

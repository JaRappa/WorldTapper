import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, useWindowDimensions } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getClickCount, incrementClickCount, wsManager } from '@/services/api';

export default function HomeScreen() {
  const [count, setCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClicking, setIsClicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastClickTime = useRef<number>(0);
  const { width: screenWidth } = useWindowDimensions();
  
  // Responsive scaling based on screen width
  const isSmallScreen = screenWidth < 375;
  const isMediumScreen = screenWidth >= 375 && screenWidth < 768;
  
  // Dynamic sizes
  const emojiSize = isSmallScreen ? 100 : isMediumScreen ? 130 : 150;
  const counterFontSize = isSmallScreen ? 32 : isMediumScreen ? 40 : 48;
  const titleMarginBottom = isSmallScreen ? 4 : 8;
  const sectionSpacing = isSmallScreen ? 24 : 40;

  // Initial fetch
  const fetchCount = async () => {
    try {
      setError(null);
      const response = await getClickCount();
      setCount(response.count);
    } catch (err) {
      setError('Failed to load count');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Set up WebSocket for real-time updates
  useEffect(() => {
    fetchCount();

    // Subscribe to real-time count updates via WebSocket
    const unsubscribe = wsManager.subscribe((newCount) => {
      // Skip if we just clicked (to avoid overwriting optimistic update with stale data)
      if (Date.now() - lastClickTime.current < 500) return;
      setCount(newCount);
    });

    // Handle app state changes
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        fetchCount(); // Refresh when app becomes active
      }
    });

    return () => {
      unsubscribe();
      subscription.remove();
    };
  }, []);

  const handleClick = useCallback(async () => {
    if (isClicking) return;

    setIsClicking(true);
    lastClickTime.current = Date.now(); // Track click time to avoid poll conflicts
    
    // Trigger haptic feedback
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Haptics not available on web
    }

    // Optimistic update
    setCount(prev => (prev ?? 0) + 1);

    try {
      const response = await incrementClickCount();
      // Update with actual count from server
      setCount(response.count);
      setError(null);
    } catch (err) {
      // Revert optimistic update on error
      setCount(prev => (prev ?? 1) - 1);
      setError('Click failed - try again!');
      console.error(err);
    } finally {
      setIsClicking(false);
    }
  }, [isClicking]);

  const formatCount = (num: number): string => {
    if (num >= 1_000_000_000) {
      return (num / 1_000_000_000).toFixed(1) + 'B';
    }
    if (num >= 1_000_000) {
      return (num / 1_000_000).toFixed(1) + 'M';
    }
    if (num >= 1_000) {
      return (num / 1_000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={[styles.title, { marginBottom: titleMarginBottom }]}>
        🌍 World Tapper
      </ThemedText>
      
      <ThemedText style={[styles.subtitle, { marginBottom: sectionSpacing }]}>
        Everyone taps together!
      </ThemedText>

      <Pressable
        onPress={handleClick}
        disabled={isLoading}
        style={({ pressed }) => [
          styles.worldButton,
          pressed && styles.worldButtonPressed,
        ]}
      >
        <ThemedText style={[styles.worldEmoji, { fontSize: emojiSize, lineHeight: emojiSize * 1.15 }]}>🌍</ThemedText>
      </Pressable>

      <ThemedView style={[styles.counterContainer, { marginTop: sectionSpacing }]}>
        {isLoading ? (
          <ActivityIndicator size="large" color="#0a7ea4" />
        ) : (
          <>
            <ThemedText style={styles.counterLabel}>Global Clicks</ThemedText>
            <ThemedText type="title" style={[styles.counter, { fontSize: counterFontSize, lineHeight: counterFontSize * 1.3 }]}>
              {count !== null ? formatCount(count) : '—'}
            </ThemedText>
          </>
        )}
      </ThemedView>

      {error && (
        <ThemedText style={styles.error}>{error}</ThemedText>
      )}

      <ThemedText style={[styles.instruction, { marginTop: sectionSpacing }]}>
        Tap the Earth to add your click!
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    paddingHorizontal: 12,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
  },
  worldButton: {
    padding: 20,
    borderRadius: 100,
    transform: [{ scale: 1 }],
  },
  worldButtonPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.9,
  },
  worldEmoji: {
    textAlign: 'center',
  },
  counterContainer: {
    alignItems: 'center',
    minHeight: 80,
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 8,
  },
  counterLabel: {
    fontSize: 14,
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 12,
    textAlign: 'center',
  },
  counter: {
    fontWeight: 'bold',
    textAlign: 'center',
    flexShrink: 1,
    flexWrap: 'wrap',
    paddingTop: 4,
  },
  error: {
    color: '#e74c3c',
    marginTop: 16,
    fontSize: 14,
    textAlign: 'center',
  },
  instruction: {
    opacity: 0.5,
    fontSize: 14,
    textAlign: 'center',
  },
});

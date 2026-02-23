import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AnimatedCounter } from '@/components/animated-counter';
import { AuthModal } from '@/components/auth-modal';
import { AutoClickerRing } from '@/components/auto-clicker-ring';
import { InventoryModal } from '@/components/inventory-modal';
import { StoreModal } from '@/components/store-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { calculateTotalClicksPerMinute, formatClicksPerMinute } from '@/constants/store-items';
import { useAuth } from '@/contexts/auth-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getClickCount, incrementClickCount, purchaseItem, wsManager } from '@/services/api';

const MIN_CLICK_INTERVAL_MS = 100; // 0.1 seconds = max 10 clicks per second
const CLICK_BATCH_INTERVAL_MS = 1000; // Batch clicks every 1 second for API efficiency

export default function HomeScreen() {
  const [count, setCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showStore, setShowStore] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [optimisticBalanceBonus, setOptimisticBalanceBonus] = useState(0);
  const lastClickTime = useRef<number>(0);
  const pendingClicks = useRef<number>(0);
  const batchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { width: screenWidth } = useWindowDimensions();
  
  const { user, userData, isSignedIn, signIn, signUp, confirmSignUp, signOut, refreshUserData } = useAuth();
  const tintColor = useThemeColor({}, 'tint');
  
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
        if (isSignedIn) {
          refreshUserData();
        }
      } else if (state === 'background' || state === 'inactive') {
        // Flush any pending clicks before backgrounding
        if (pendingClicks.current > 0) {
          const clicksToSend = pendingClicks.current;
          pendingClicks.current = 0;
          incrementClickCount(user?.sub, clicksToSend).catch(() => {});
        }
      }
    });

    return () => {
      unsubscribe();
      subscription.remove();
      // Cleanup batch timeout
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
    };
  }, [isSignedIn, refreshUserData]);

  // Flush pending clicks to the server
  const flushPendingClicks = useCallback(async () => {
    const clicksToSend = pendingClicks.current;
    if (clicksToSend <= 0) return;
    
    pendingClicks.current = 0;
    
    try {
      console.log('Flushing clicks:', clicksToSend, 'user:', user?.sub ? `sub=${user.sub}` : 'no user');
      const response = await incrementClickCount(user?.sub, clicksToSend);
      console.log('Flush response:', response);
      // Update with actual count from server
      setCount(response.count);
      setError(null);
      
      // Refresh user data if signed in (to update balance)
      if (isSignedIn) {
        await refreshUserData();
        // Reset optimistic bonus since we now have real data
        setOptimisticBalanceBonus(0);
      }
    } catch (err: any) {
      // Revert optimistic update on error
      setCount(prev => (prev ?? clicksToSend) - clicksToSend);
      setOptimisticBalanceBonus(prev => Math.max(0, prev - clicksToSend));
      console.error('Click flush failed:', err?.message || err);
      setError('Click failed - try again!');
    }
  }, [user, isSignedIn, refreshUserData]);

  const handleClick = useCallback(() => {
    const now = Date.now();
    
    // Rate limit: minimum 100ms between clicks (max 10 clicks/second)
    if (now - lastClickTime.current < MIN_CLICK_INTERVAL_MS) {
      return;
    }
    
    lastClickTime.current = now;
    
    // Trigger haptic feedback (fire and forget)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {
      // Haptics not available on web
    });

    // Optimistic update - instant UI feedback
    setCount(prev => (prev ?? 0) + 1);
    
    // Optimistically update balance display if signed in
    if (isSignedIn) {
      setOptimisticBalanceBonus(prev => prev + 1);
    }
    
    // Accumulate clicks for batching
    pendingClicks.current += 1;
    
    // Clear any existing timeout and set a new one
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }
    
    // Flush clicks to server after 1 second of no clicking
    batchTimeoutRef.current = setTimeout(() => {
      flushPendingClicks();
      batchTimeoutRef.current = null;
    }, CLICK_BATCH_INTERVAL_MS);
  }, [flushPendingClicks, isSignedIn]);

  // Called every 30 seconds with accumulated auto-clicks (cost-efficient batching)
  const handleBatchAutoClick = useCallback(async (clicks: number) => {
    if (clicks <= 0 || !user) return;
    
    try {
      // Send batch of clicks to server in a single API call
      const response = await incrementClickCount(user.sub, clicks);
      // Update with the server's authoritative count
      setCount(response.count);
      // Refresh user data to sync balance from server
      await refreshUserData();
      // Reset optimistic bonus since we now have real data
      setOptimisticBalanceBonus(0);
    } catch (err) {
      console.error('Batch auto-click failed:', err);
    }
  }, [user, refreshUserData]);

  // Called frequently for local UI updates (no API call)
  const handleLocalAutoClick = useCallback((clicks: number) => {
    // Optimistic UI update - adds to displayed count instantly
    setCount(prev => (prev ?? 0) + clicks);
    // Also optimistically update balance display
    setOptimisticBalanceBonus(prev => prev + clicks);
  }, []);

  const handlePurchase = async (itemId: string) => {
    if (!user) return;
    
    setIsPurchasing(true);
    try {
      const result = await purchaseItem(user.sub, itemId);
      if (result.success) {
        await refreshUserData();
      } else {
        setError(result.error || 'Purchase failed');
      }
    } catch (err) {
      console.error('Purchase failed:', err);
      setError('Purchase failed - try again!');
    } finally {
      setIsPurchasing(false);
    }
  };

  // Always show full number with commas
  const formatCount = (num: number): string => {
    return num.toLocaleString();
  };
  
  // Calculate font size based on number of digits to fit on screen
  const getCounterFontSize = (num: number): number => {
    const digits = num.toString().length;
    const baseSize = isSmallScreen ? 32 : isMediumScreen ? 40 : 48;
    
    // Scale down for longer numbers
    if (digits <= 6) return baseSize;
    if (digits <= 9) return Math.floor(baseSize * 0.75);
    if (digits <= 12) return Math.floor(baseSize * 0.6);
    if (digits <= 15) return Math.floor(baseSize * 0.5);
    return Math.floor(baseSize * 0.4);
  };
  
  const dynamicCounterFontSize = count !== null ? getCounterFontSize(count) : counterFontSize;
  
  // Balance value for display
  const balanceValue = (userData?.balance || 0) + optimisticBalanceBonus;

  const totalClicksPerMinute = userData?.ownedItems 
    ? calculateTotalClicksPerMinute(userData.ownedItems) 
    : 0;

  return (
    <ThemedView style={styles.container}>
      {/* Header with auth/user controls */}
      <View style={styles.header}>
        {isSignedIn ? (
          <View style={styles.userInfo}>
            <ThemedText style={styles.welcomeText}>
              👋 {user?.username}
            </ThemedText>
            <Pressable onPress={signOut} style={styles.signOutButton}>
              <ThemedText style={styles.signOutText}>Sign Out</ThemedText>
            </Pressable>
          </View>
        ) : (
          <Pressable 
            onPress={() => setShowAuth(true)} 
            style={[styles.signInButton, { backgroundColor: tintColor }]}
          >
            <ThemedText style={styles.signInText}>Sign In</ThemedText>
          </Pressable>
        )}
      </View>

      <ThemedText type="title" style={[styles.title, { marginBottom: titleMarginBottom }]}>
        🌍 World Tapper
      </ThemedText>
      
      <ThemedText style={[styles.subtitle, { marginBottom: sectionSpacing }]}>
        Everyone taps together!
      </ThemedText>

      {/* World button with auto-clicker ring */}
      <View style={[styles.worldContainer, { width: emojiSize + 180, height: emojiSize + 180 }]}>
        {userData?.ownedItems && Object.keys(userData.ownedItems).length > 0 && (
          <AutoClickerRing
            ownedItems={userData.ownedItems}
            worldSize={emojiSize}
            onBatchClick={handleBatchAutoClick}
            onLocalClick={handleLocalAutoClick}
          />
        )}
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
      </View>

      <ThemedView style={[styles.counterContainer, { marginTop: sectionSpacing }]}>
        {isLoading ? (
          <ActivityIndicator size="large" color="#0a7ea4" />
        ) : (
          <>
            <ThemedText style={styles.counterLabel}>Global Clicks</ThemedText>
            <ThemedText type="title" style={[styles.counter, { fontSize: dynamicCounterFontSize, lineHeight: dynamicCounterFontSize * 1.3 }]}>
              {count !== null ? formatCount(count) : '—'}
            </ThemedText>
          </>
        )}
      </ThemedView>

      {/* User balance when signed in */}
      {isSignedIn && (
        <View style={styles.balanceContainer}>
          <ThemedText style={styles.balanceLabel}>Your Balance</ThemedText>
          <AnimatedCounter
            value={balanceValue}
            style={styles.balanceAmount}
            prefix="🖱️ "
            duration={300}
          />
        </View>
      )}

      {/* Show clicks per minute if user has auto-clickers */}
      {totalClicksPerMinute > 0 && (
        <ThemedText style={styles.clicksPerMinute}>
          ⚡ {formatClicksPerMinute(totalClicksPerMinute)}
        </ThemedText>
      )}

      {error && (
        <ThemedText style={styles.error}>{error}</ThemedText>
      )}

      {/* Store and Inventory buttons for signed-in users */}
      {isSignedIn && (
        <View style={styles.actionButtons}>
          <Pressable 
            style={[styles.actionButton, { backgroundColor: tintColor }]}
            onPress={() => setShowStore(true)}
          >
            <ThemedText style={styles.actionButtonText}>🏪 Store</ThemedText>
          </Pressable>
          <Pressable 
            style={[styles.actionButton, styles.inventoryButton]}
            onPress={() => setShowInventory(true)}
          >
            <ThemedText style={styles.actionButtonText}>🎒 Inventory</ThemedText>
          </Pressable>
        </View>
      )}

      <ThemedText style={[styles.instruction, { marginTop: isSignedIn ? 16 : sectionSpacing }]}>
        {isSignedIn 
          ? 'Tap to earn clicks & buy auto-clickers!' 
          : 'Tap the Earth to add your click!'}
      </ThemedText>

      {/* Store Modal */}
      <StoreModal
        visible={showStore}
        onClose={() => setShowStore(false)}
        balance={userData?.balance || 0}
        ownedItems={userData?.ownedItems || {}}
        onPurchase={handlePurchase}
        isPurchasing={isPurchasing}
      />

      {/* Auth Modal */}
      <AuthModal
        visible={showAuth}
        onClose={() => setShowAuth(false)}
        onSignIn={signIn}
        onSignUp={signUp}
        onConfirmSignUp={confirmSignUp}
      />

      {/* Inventory Modal */}
      <InventoryModal
        visible={showInventory}
        onClose={() => setShowInventory(false)}
        ownedItems={userData?.ownedItems || {}}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 12,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  welcomeText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  balanceButton: {
    backgroundColor: 'rgba(10, 126, 164, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  balanceText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  signOutButton: {
    padding: 8,
  },
  signOutText: {
    opacity: 0.6,
    fontSize: 14,
  },
  signInButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  signInText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
  },
  title: {
    textAlign: 'center',
    lineHeight: 42,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.7,
    textAlign: 'center',
  },
  worldContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  worldButton: {
    padding: 20,
    borderRadius: 100,
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
  clicksPerMinute: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 8,
  },
  balanceContainer: {
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: 'rgba(10, 126, 164, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
  },
  balanceLabel: {
    fontSize: 12,
    lineHeight: 18,
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: 'bold',
  },
  error: {
    color: '#e74c3c',
    marginTop: 16,
    fontSize: 14,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  actionButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  inventoryButton: {
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
  },
  actionButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  storeButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  storeButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  instruction: {
    opacity: 0.5,
    fontSize: 14,
    textAlign: 'center',
  },
});

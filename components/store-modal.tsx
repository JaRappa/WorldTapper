/**
 * Store Modal Component
 * 
 * Shows purchasable items for signed-in users.
 */

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { calculatePrice, formatClicksPerMinute, STORE_ITEMS, StoreItem } from '@/constants/store-items';
import { useThemeColor } from '@/hooks/use-theme-color';
import React from 'react';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';

interface StoreModalProps {
  visible: boolean;
  onClose: () => void;
  balance: number;
  ownedItems: Record<string, number>;
  onPurchase: (itemId: string) => Promise<void>;
  isPurchasing: boolean;
}

interface StoreItemCardProps {
  item: StoreItem;
  balance: number;
  ownedCount: number;
  onPurchase: () => void;
  isPurchasing: boolean;
}

function StoreItemCard({ item, balance, ownedCount, onPurchase, isPurchasing }: StoreItemCardProps) {
  const price = calculatePrice(item, ownedCount);
  const canAfford = balance >= price;
  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');
  
  return (
    <View style={[styles.itemCard, { backgroundColor }]}>
      <View style={styles.itemHeader}>
        <ThemedText style={styles.itemEmoji}>{item.emoji}</ThemedText>
        <View style={styles.itemInfo}>
          <ThemedText style={styles.itemName}>{item.name}</ThemedText>
          <ThemedText style={styles.itemDescription}>{item.description}</ThemedText>
          <ThemedText style={styles.itemStats}>
            ⚡ {formatClicksPerMinute(item.clicksPerMinute)}
          </ThemedText>
        </View>
      </View>
      
      <View style={styles.itemFooter}>
        <ThemedText style={styles.ownedCount}>
          Owned: {ownedCount}
        </ThemedText>
        
        <Pressable
          style={[
            styles.buyButton,
            { backgroundColor: canAfford ? tintColor : '#666' },
            !canAfford && styles.buyButtonDisabled,
          ]}
          onPress={onPurchase}
          disabled={!canAfford || isPurchasing}
        >
          {isPurchasing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <ThemedText style={[styles.buyButtonText, canAfford && styles.buyButtonTextAffordable]}>
              🖱️ {formatNumber(price)}
            </ThemedText>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}

export function StoreModal({
  visible,
  onClose,
  balance,
  ownedItems,
  onPurchase,
  isPurchasing,
}: StoreModalProps) {
  const backgroundColor = useThemeColor({}, 'background');
  
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <ThemedView style={[styles.modalContent, { backgroundColor }]}>
          <View style={styles.header}>
            <ThemedText type="title" style={styles.title}>🏪 Store</ThemedText>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <ThemedText style={styles.closeButtonText}>✕</ThemedText>
            </Pressable>
          </View>
          
          <View style={styles.balanceContainer}>
            <ThemedText style={styles.balanceLabel}>Your Balance</ThemedText>
            <ThemedText style={styles.balanceValue}>🖱️ {formatNumber(balance)}</ThemedText>
          </View>
          
          <ScrollView style={styles.itemsList} showsVerticalScrollIndicator={false}>
            {STORE_ITEMS.map(item => (
              <StoreItemCard
                key={item.id}
                item={item}
                balance={balance}
                ownedCount={ownedItems[item.id] || 0}
                onPurchase={() => onPurchase(item.id)}
                isPurchasing={isPurchasing}
              />
            ))}
            <View style={styles.bottomPadding} />
          </ScrollView>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
    opacity: 0.6,
  },
  balanceContainer: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(10, 126, 164, 0.1)',
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 14,
    opacity: 0.6,
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  itemsList: {
    flex: 1,
  },
  itemCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.2)',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  itemEmoji: {
    fontSize: 40,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 4,
  },
  itemStats: {
    fontSize: 12,
    opacity: 0.6,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ownedCount: {
    fontSize: 14,
    opacity: 0.6,
  },
  buyButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 100,
    alignItems: 'center',
  },
  buyButtonDisabled: {
    opacity: 0.5,
  },
  buyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  buyButtonTextAffordable: {
    color: '#000',
  },
  bottomPadding: {
    height: 20,
  },
});

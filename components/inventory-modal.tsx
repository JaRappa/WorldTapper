/**
 * Inventory Modal Component
 * 
 * Shows all owned auto-clickers for the signed-in user.
 */

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { formatClicksPerMinute, STORE_ITEMS } from '@/constants/store-items';
import { useThemeColor } from '@/hooks/use-theme-color';
import React from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';

interface InventoryModalProps {
  visible: boolean;
  onClose: () => void;
  ownedItems: Record<string, number>;
}

export function InventoryModal({
  visible,
  onClose,
  ownedItems,
}: InventoryModalProps) {
  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');
  
  const totalItems = Object.values(ownedItems).reduce((sum, count) => sum + count, 0);
  
  // Get items that user owns
  const ownedItemsList = STORE_ITEMS.filter(item => (ownedItems[item.id] || 0) > 0);
  
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
            <ThemedText type="title" style={styles.title}>
              🎒 My Inventory
            </ThemedText>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <ThemedText style={styles.closeButtonText}>✕</ThemedText>
            </Pressable>
          </View>
          
          <ThemedText style={styles.subtitle}>
            {totalItems} auto-clicker{totalItems !== 1 ? 's' : ''} owned
          </ThemedText>
          
          <ScrollView style={styles.itemList} showsVerticalScrollIndicator={false}>
            {ownedItemsList.length === 0 ? (
              <View style={styles.emptyState}>
                <ThemedText style={styles.emptyEmoji}>🛒</ThemedText>
                <ThemedText style={styles.emptyText}>
                  No auto-clickers yet!
                </ThemedText>
                <ThemedText style={styles.emptySubtext}>
                  Visit the store to buy some
                </ThemedText>
              </View>
            ) : (
              ownedItemsList.map((item) => {
                const count = ownedItems[item.id] || 0;
                const totalClicksPerMin = item.clicksPerMinute * count;
                
                return (
                  <View key={item.id} style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <ThemedText style={styles.itemEmoji}>{item.emoji}</ThemedText>
                      <View style={styles.itemInfo}>
                        <ThemedText style={styles.itemName}>{item.name}</ThemedText>
                        <ThemedText style={styles.itemCount}>
                          ×{count}
                        </ThemedText>
                      </View>
                    </View>
                    <View style={styles.itemStats}>
                      <ThemedText style={styles.itemStat}>
                        ⚡ {formatClicksPerMinute(totalClicksPerMin)}
                      </ThemedText>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
          
          <Pressable
            style={[styles.closeModalButton, { backgroundColor: tintColor }]}
            onPress={onClose}
          >
            <ThemedText style={styles.closeModalButtonText}>Close</ThemedText>
          </Pressable>
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
    padding: 24,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  subtitle: {
    fontSize: 14,
    opacity: 0.6,
    marginBottom: 16,
  },
  itemList: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    opacity: 0.6,
  },
  itemCard: {
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemEmoji: {
    fontSize: 36,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  itemCount: {
    fontSize: 20,
    fontWeight: 'bold',
    opacity: 0.8,
  },
  itemStats: {
    marginLeft: 48,
  },
  itemStat: {
    fontSize: 14,
    opacity: 0.7,
  },
  closeModalButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  closeModalButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getLeaderboard, LeaderboardEntry } from '@/services/api';

interface LeaderboardModalProps {
  visible: boolean;
  onClose: () => void;
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
}

function getMedalEmoji(rank: number): string {
  switch (rank) {
    case 1: return '🥇';
    case 2: return '🥈';
    case 3: return '🥉';
    default: return `#${rank}`;
  }
}

function LeaderboardRow({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const isTopThree = rank <= 3;
  
  return (
    <View style={[styles.row, isTopThree && styles.topThreeRow]}>
      <View style={styles.rankContainer}>
        <ThemedText style={[styles.rank, isTopThree && styles.topThreeRank]}>
          {getMedalEmoji(rank)}
        </ThemedText>
      </View>
      <View style={styles.userInfoContainer}>
        <ThemedText style={[styles.username, isTopThree && styles.topThreeUsername]}>
          {entry.username || 'Anonymous'}
        </ThemedText>
        <ThemedText style={styles.joinDate}>
          Joined {formatDate(entry.createdAt)}
        </ThemedText>
      </View>
      <View style={styles.clicksContainer}>
        <ThemedText style={[styles.clicks, isTopThree && styles.topThreeClicks]}>
          {formatNumber(entry.totalClicks)}
        </ThemedText>
        <ThemedText style={styles.clicksLabel}>clicks</ThemedText>
      </View>
    </View>
  );
}

export function LeaderboardModal({ visible, onClose }: LeaderboardModalProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const backgroundColor = useThemeColor({}, 'background');

  useEffect(() => {
    if (visible) {
      fetchLeaderboard();
    }
  }, [visible]);

  const fetchLeaderboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getLeaderboard();
      setLeaderboard(data);
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
      setError('Failed to load leaderboard');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <ThemedView style={[styles.modalContent, { backgroundColor }]}>
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
              <ThemedText type="title" style={styles.title}>🏆 Leaderboard</ThemedText>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <ThemedText style={styles.closeButtonText}>✕</ThemedText>
              </Pressable>
            </View>
            
            <View style={styles.columnHeaders}>
              <ThemedText style={styles.columnHeader}>Rank</ThemedText>
              <ThemedText style={[styles.columnHeader, styles.playerHeader]}>Player</ThemedText>
              <ThemedText style={[styles.columnHeader, styles.clicksHeader]}>Total Clicks</ThemedText>
            </View>
            
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0a7ea4" />
                <ThemedText style={styles.loadingText}>Loading leaderboard...</ThemedText>
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <ThemedText style={styles.errorText}>{error}</ThemedText>
                <Pressable onPress={fetchLeaderboard} style={styles.retryButton}>
                  <ThemedText style={styles.retryText}>Retry</ThemedText>
                </Pressable>
              </View>
            ) : leaderboard.length === 0 ? (
              <View style={styles.emptyContainer}>
                <ThemedText style={styles.emptyText}>No players yet!</ThemedText>
                <ThemedText style={styles.emptySubtext}>Be the first to join!</ThemedText>
              </View>
            ) : (
              <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {leaderboard.map((entry, index) => (
                  <LeaderboardRow key={entry.odaUserId} entry={entry} rank={index + 1} />
                ))}
                <View style={styles.bottomPadding} />
              </ScrollView>
            )}
          </SafeAreaView>
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
    height: '80%',
  },
  safeArea: {
    flex: 1,
    padding: 20,
    paddingTop: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    lineHeight: 32,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
    opacity: 0.6,
  },
  columnHeaders: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
    marginBottom: 8,
  },
  columnHeader: {
    fontSize: 12,
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: 1,
    width: 50,
  },
  playerHeader: {
    flex: 1,
  },
  clicksHeader: {
    width: 100,
    textAlign: 'right',
  },
  scrollView: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 4,
  },
  topThreeRow: {
    backgroundColor: 'rgba(10, 126, 164, 0.1)',
  },
  rankContainer: {
    width: 50,
    alignItems: 'center',
  },
  rank: {
    fontSize: 16,
    opacity: 0.7,
  },
  topThreeRank: {
    fontSize: 24,
    opacity: 1,
  },
  userInfoContainer: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '500',
  },
  topThreeUsername: {
    fontWeight: 'bold',
    fontSize: 18,
  },
  joinDate: {
    fontSize: 12,
    opacity: 0.5,
    marginTop: 2,
  },
  clicksContainer: {
    width: 100,
    alignItems: 'flex-end',
  },
  clicks: {
    fontSize: 16,
    fontWeight: '600',
  },
  topThreeClicks: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  clicksLabel: {
    fontSize: 10,
    opacity: 0.5,
    textTransform: 'uppercase',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    opacity: 0.6,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#e74c3c',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: 'rgba(10, 126, 164, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryText: {
    color: '#0a7ea4',
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    opacity: 0.7,
  },
  emptySubtext: {
    fontSize: 14,
    opacity: 0.5,
    marginTop: 8,
  },
  bottomPadding: {
    height: 20,
  },
});

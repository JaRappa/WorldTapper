/**
 * Auth Modal Component
 * 
 * Sign in / Sign up modal for users.
 */

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    TextInput,
    View
} from 'react-native';
import { LegalModal } from './legal-modal';

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string, username: string) => Promise<{ userConfirmed: boolean; username: string }>;
  onConfirmSignUp: (username: string, code: string) => Promise<void>;
}

type AuthMode = 'signin' | 'signup' | 'confirm';

export function AuthModal({
  visible,
  onClose,
  onSignIn,
  onSignUp,
  onConfirmSignUp,
}: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState<'terms' | 'privacy' | null>(null);
  
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  
  const resetForm = () => {
    setEmail('');
    setPassword('');
    setUsername('');
    setConfirmCode('');
    setError(null);
    setMode('signin');
    setAgreedToTerms(false);
  };
  
  const handleClose = () => {
    resetForm();
    onClose();
  };
  
  const handleSignIn = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      await onSignIn(email, password);
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Sign in failed');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSignUp = async () => {
    if (!email || !password || !username) {
      setError('Please fill in all fields');
      return;
    }
    
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    
    if (!agreedToTerms) {
      setError('You must agree to the Terms of Service and Privacy Policy');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await onSignUp(email, password, username);
      if (!result.userConfirmed) {
        setMode('confirm');
      } else {
        // Auto sign in
        await onSignIn(email, password);
        handleClose();
      }
    } catch (err: any) {
      setError(err.message || 'Sign up failed');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleConfirm = async () => {
    if (!confirmCode) {
      setError('Please enter the confirmation code');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      await onConfirmSignUp(username, confirmCode);
      await onSignIn(username, password);
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Confirmation failed');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <ThemedView style={[styles.modalContent, { backgroundColor }]}>
          <View style={styles.header}>
            <ThemedText type="title" style={styles.title}>
              {mode === 'signin' ? '👋 Welcome Back' : mode === 'signup' ? '🎉 Join Us' : '✉️ Confirm Email'}
            </ThemedText>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <ThemedText style={styles.closeButtonText}>✕</ThemedText>
            </Pressable>
          </View>
          
          {mode === 'confirm' ? (
            <>
              <ThemedText style={styles.subtitle}>
                We sent a confirmation code to {email}
              </ThemedText>
              
              <TextInput
                style={[styles.input, { color: textColor, borderColor: tintColor }]}
                placeholder="Confirmation Code"
                placeholderTextColor="#888"
                value={confirmCode}
                onChangeText={setConfirmCode}
                keyboardType="number-pad"
                autoCapitalize="none"
              />
            </>
          ) : (
            <>
              {mode === 'signup' && (
                <TextInput
                  style={[styles.input, { color: textColor, borderColor: tintColor }]}
                  placeholder="Username"
                  placeholderTextColor="#888"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                />
              )}
              
              <TextInput
                style={[styles.input, { color: textColor, borderColor: tintColor }]}
                placeholder="Email"
                placeholderTextColor="#888"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              
              <TextInput
                style={[styles.input, { color: textColor, borderColor: tintColor }]}
                placeholder="Password"
                placeholderTextColor="#888"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              
              {mode === 'signup' && (
                <View style={styles.checkboxContainer}>
                  <Pressable
                    style={[
                      styles.checkbox,
                      { borderColor: tintColor },
                      agreedToTerms && { backgroundColor: tintColor },
                    ]}
                    onPress={() => setAgreedToTerms(!agreedToTerms)}
                  >
                    {agreedToTerms && (
                      <ThemedText style={styles.checkmark}>✓</ThemedText>
                    )}
                  </Pressable>
                  <View style={styles.checkboxTextContainer}>
                    <ThemedText style={styles.checkboxText}>
                      I am at least 14 years old and agree to the{' '}
                    </ThemedText>
                    <View style={styles.legalLinksRow}>
                      <Pressable onPress={() => setShowLegalModal('terms')}>
                        <ThemedText style={[styles.legalLink, { color: tintColor }]}>
                          Terms of Service
                        </ThemedText>
                      </Pressable>
                      <ThemedText style={styles.checkboxText}> and </ThemedText>
                      <Pressable onPress={() => setShowLegalModal('privacy')}>
                        <ThemedText style={[styles.legalLink, { color: tintColor }]}>
                          Privacy Policy
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>
                </View>
              )}
            </>
          )}
          
          {error && (
            <ThemedText style={styles.error}>{error}</ThemedText>
          )}
          
          <Pressable
            style={[styles.submitButton, { backgroundColor: tintColor }]}
            onPress={mode === 'signin' ? handleSignIn : mode === 'signup' ? handleSignUp : handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.submitButtonText}>
                {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Confirm'}
              </ThemedText>
            )}
          </Pressable>
          
          {mode !== 'confirm' && (
            <Pressable
              style={styles.switchModeButton}
              onPress={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setError(null);
                setAgreedToTerms(false);
              }}
            >
              <ThemedText style={styles.switchModeText}>
                {mode === 'signin' ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
              </ThemedText>
            </Pressable>
          )}
        </ThemedView>
      </KeyboardAvoidingView>
      
      {/* Legal Modals */}
      {showLegalModal && (
        <LegalModal
          visible={true}
          onClose={() => setShowLegalModal(null)}
          type={showLegalModal}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 24,
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
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
    opacity: 0.7,
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 12,
  },
  error: {
    color: '#e74c3c',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  submitButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  switchModeButton: {
    padding: 16,
    alignItems: 'center',
  },
  switchModeText: {
    opacity: 0.7,
    fontSize: 14,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    marginTop: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: 6,
    marginRight: 12,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#000',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxTextContainer: {
    flex: 1,
  },
  checkboxText: {
    fontSize: 13,
    opacity: 0.8,
    lineHeight: 20,
  },
  legalLinksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  legalLink: {
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
    lineHeight: 20,
  },
});

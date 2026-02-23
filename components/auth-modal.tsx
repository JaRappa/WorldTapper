/**
 * Auth Modal Component
 * 
 * Sign in / Sign up modal for users.
 */

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import React, { useMemo, useState } from 'react';
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

// Password requirements configuration
const PASSWORD_REQUIREMENTS = [
  { id: 'length', label: 'At least 8 characters', check: (pw: string) => pw.length >= 8 },
  { id: 'uppercase', label: 'One uppercase letter (A-Z)', check: (pw: string) => /[A-Z]/.test(pw) },
  { id: 'lowercase', label: 'One lowercase letter (a-z)', check: (pw: string) => /[a-z]/.test(pw) },
  { id: 'number', label: 'One number (0-9)', check: (pw: string) => /[0-9]/.test(pw) },
  { id: 'special', label: 'One special character (!@#$...)', check: (pw: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw) },
];

// Password Requirements Checklist Component
function PasswordRequirements({ password, tintColor }: { password: string; tintColor: string }) {
  const requirements = useMemo(() => {
    return PASSWORD_REQUIREMENTS.map(req => ({
      ...req,
      met: req.check(password),
    }));
  }, [password]);

  const allMet = requirements.every(r => r.met);

  return (
    <View style={passwordStyles.container}>
      <ThemedText style={passwordStyles.title}>
        Password Requirements {allMet && '✅'}
      </ThemedText>
      {requirements.map(req => (
        <View key={req.id} style={passwordStyles.requirement}>
          <View style={[
            passwordStyles.checkCircle,
            req.met ? { backgroundColor: tintColor, borderColor: tintColor } : { borderColor: '#666' }
          ]}>
            {req.met && <ThemedText style={passwordStyles.checkIcon}>✓</ThemedText>}
          </View>
          <ThemedText style={[
            passwordStyles.label,
            req.met && { opacity: 0.6 }
          ]}>
            {req.label}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const passwordStyles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    borderRadius: 6,
    padding: 8,
    marginBottom: 10,
  },
  title: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
    opacity: 0.9,
  },
  requirement: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  checkCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: {
    color: '#000',
    fontSize: 9,
    fontWeight: 'bold',
  },
  label: {
    fontSize: 11,
    opacity: 0.8,
  },
});

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
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  
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
    
    // Username validation
    if (username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    
    if (username.length > 20) {
      setError('Username must be 20 characters or less');
      return;
    }
    
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      setError('Username can only contain letters, numbers, underscores, and hyphens');
      return;
    }
    
    // Password complexity validation (matches Cognito policy)
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    
    if (!/[A-Z]/.test(password)) {
      setError('Password must contain at least one uppercase letter');
      return;
    }
    
    if (!/[a-z]/.test(password)) {
      setError('Password must contain at least one lowercase letter');
      return;
    }
    
    if (!/[0-9]/.test(password)) {
      setError('Password must contain at least one number');
      return;
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      setError('Password must contain at least one special character (!@#$%^&*...)');
      return;
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
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
                onFocus={() => setIsPasswordFocused(true)}
                onBlur={() => {
                  // Small delay to allow tap events on other elements to register
                  // before the layout shifts from hiding password requirements
                  setTimeout(() => setIsPasswordFocused(false), 150);
                }}
              />
              
              {mode === 'signup' && password.length > 0 && isPasswordFocused && (
                <PasswordRequirements password={password} tintColor={tintColor} />
              )}
              
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

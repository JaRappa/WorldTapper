/**
 * Authentication Context
 * 
 * Provides authentication state and methods throughout the app.
 */

import { getUserData, UserData } from '@/services/api';
import {
    confirmSignUp as authConfirmSignUp,
    signIn as authSignIn,
    signOut as authSignOut,
    signUp as authSignUp,
    AuthUser,
    getCurrentUser,
} from '@/services/auth';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface AuthContextType {
  user: AuthUser | null;
  userData: UserData | null;
  isLoading: boolean;
  isSignedIn: boolean;
  signIn: (usernameOrEmail: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<{ userConfirmed: boolean; username: string }>;
  confirmSignUp: (username: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUserData = useCallback(async () => {
    if (!user) {
      setUserData(null);
      return;
    }
    try {
      const data = await getUserData(user.sub);
      setUserData(data);
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    }
  }, [user]);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  // Fetch user data when user changes
  useEffect(() => {
    if (user) {
      refreshUserData();
    } else {
      setUserData(null);
    }
  }, [user, refreshUserData]);

  const signIn = async (usernameOrEmail: string, password: string) => {
    const signedInUser = await authSignIn(usernameOrEmail, password);
    setUser(signedInUser);
  };

  const signUp = async (email: string, password: string, username: string) => {
    const result = await authSignUp(email, password, username);
    return { userConfirmed: result.userConfirmed, username: result.username };
  };

  const confirmSignUp = async (username: string, code: string) => {
    await authConfirmSignUp(username, code);
  };

  const signOut = async () => {
    await authSignOut();
    setUser(null);
    setUserData(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userData,
        isLoading,
        isSignedIn: !!user,
        signIn,
        signUp,
        confirmSignUp,
        signOut,
        refreshUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

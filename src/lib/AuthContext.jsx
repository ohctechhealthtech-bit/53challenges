import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';
import { clearSessionToken, getSessionToken } from '@/lib/customSession';

// Custom (Challenge-API) logins carry no platform role, so admin screens would
// deny actual admins. Resolve the role from this app's own user record.
async function resolveSessionRole(u) {
  const token = getSessionToken();
  if (!token) return u;
  try {
    const res = await base44.functions.invoke('sessionRole', { session_token: token });
    const role = res.data?.role;
    return role ? { ...u, role } : u;
  } catch {
    return u;
  }
}

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);

      // Challenge-API session (no platform token): restore from localStorage
      // and skip the platform auth gate entirely.
      if (!appParams.token) {
        const saved = localStorage.getItem('challengeApi_session');
        // A saved profile without its signed token is a dead session: the UI
        // would look signed in while every server call is refused. Drop it.
        if (saved && !getSessionToken()) {
          try { localStorage.removeItem('challengeApi_session'); } catch {}
        } else if (saved) {
          try {
            const u = JSON.parse(saved);
            const withRole = await resolveSessionRole(u);
            setUser(withRole);
            setIsAuthenticated(true);
            setAuthChecked(true);
            setIsLoadingAuth(false);
            setIsLoadingPublicSettings(false);
            return;
          } catch {}
        }
      }
      
      // First, check app public settings (with token if available)
      // This will tell us if auth is required, user not registered, etc.
      const appClient = createAxiosClient({
        baseURL: `/api/apps/public`,
        headers: {
          'X-App-Id': appParams.appId
        },
        token: appParams.token, // Include token if available
        interceptResponses: true
      });
      
      try {
        const publicSettings = await appClient.get(`/prod/public-settings/by-id/${appParams.appId}`);
        setAppPublicSettings(publicSettings);
        
        // If we got the app public settings successfully, check if user is authenticated
        if (appParams.token) {
          await checkUserAuth();
        } else {
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
          setAuthChecked(true);
        }
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        console.error('App state check failed:', appError);
        
        // Handle app-level errors
        if (appError.status === 403 && appError.data?.extra_data?.reason) {
          const reason = appError.data.extra_data.reason;
          if (reason === 'auth_required') {
            setAuthError({
              type: 'auth_required',
              message: 'Authentication required'
            });
          } else if (reason === 'user_not_registered') {
            setAuthError({
              type: 'user_not_registered',
              message: 'User not registered for this app'
            });
          } else {
            setAuthError({
              type: reason,
              message: appError.message
            });
          }
        } else {
          setAuthError({
            type: 'unknown',
            message: appError.message || 'Failed to load app'
          });
        }
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      // Now check if the user is authenticated
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);
      
      // If user auth fails, it might be an expired token
      if (error.status === 401 || error.status === 403) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
      }
    }
  };

  const setChallengeApiSession = (user) => {
    try { localStorage.setItem('challengeApi_session', JSON.stringify(user)); } catch {}
    setUser(user);
    setIsAuthenticated(true);
    setAuthChecked(true);
    setAuthError(null);
  };

  const clearChallengeApiSession = () => {
    try { localStorage.removeItem('challengeApi_session'); } catch {}
    clearSessionToken();
  };

  const logout = (shouldRedirect = true) => {
    clearChallengeApiSession();
    setUser(null);
    setIsAuthenticated(false);
    
    if (shouldRedirect) {
      // Use the SDK's logout method which handles token cleanup and redirect
      base44.auth.logout(window.location.href);
    } else {
      // Just remove the token without redirect
      base44.auth.logout();
    }
  };

  const navigateToLogin = () => {
    // Send unauthenticated users to the in-app custom login page (with a
    // returnTo so they land back where they started). No-op when already on
    // an auth route to avoid a redirect loop.
    const p = window.location.pathname;
    const authRoutes = ['/login', '/register', '/forgot-password', '/reset-password', '/age-gate'];
    if (authRoutes.includes(p)) return;
    window.location.href = `/login?returnTo=${encodeURIComponent(window.location.href)}`;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState,
      setChallengeApiSession,
      clearChallengeApiSession
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
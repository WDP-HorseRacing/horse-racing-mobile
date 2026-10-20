import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { ApiError, setUnauthorizedTokenRefreshHandler } from "@/services/api-client";
import {
  authService,
  type AuthTokens,
  type AuthUser,
  type GoogleOidcCallback,
} from "@/services/auth.service";
import { appRoleFromAuthRoles } from "@/features/auth/role-mapper";
import type { RoleId } from "@/types/raceos";

const STORAGE_KEY = "raceos.auth.session.v1";

type StoredSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  expiresIn?: number;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  role: RoleId | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: unknown;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (query: GoogleOidcCallback) => Promise<RoleId>;
  signOut: () => Promise<void>;
  retrySession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const googleOidcAttempts = new Map<string, Promise<RoleId>>();

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<StoredSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<unknown>(null);
  const sessionRef = useRef<StoredSession | null>(null);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  const refreshAccessToken = useCallback(async (failedToken?: string): Promise<string | null> => {
    const current = sessionRef.current;
    if (!current?.refreshToken) return null;

    // Another request may already have refreshed this token while this 401 was in flight.
    if (failedToken && current.accessToken !== failedToken) return current.accessToken;
    if (!failedToken && !shouldRefreshSession(current)) return current.accessToken;
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    const refreshPromise = (async () => {
      try {
        const tokens = await authService.refresh(current.refreshToken);
        const nextSession = toStoredSession(tokens);
        if (sessionRef.current?.refreshToken !== current.refreshToken) {
          return sessionRef.current?.accessToken ?? null;
        }

        await persistSession(nextSession);
        sessionRef.current = nextSession;
        setSession(nextSession);
        return nextSession.accessToken;
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.status === 401 &&
          sessionRef.current?.refreshToken === current.refreshToken
        ) {
          sessionRef.current = null;
          setSession(null);
          setUser(null);
          setAuthError(error);
          await AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
        }
        throw error;
      }
    })();
    refreshPromiseRef.current = refreshPromise;

    try {
      return await refreshPromise;
    } finally {
      if (refreshPromiseRef.current === refreshPromise) refreshPromiseRef.current = null;
    }
  }, []);

  const restoreSession = useCallback(async () => {
    try {
      const serialized = await AsyncStorage.getItem(STORAGE_KEY);
      if (!serialized) {
        sessionRef.current = null;
        setSession(null);
        setUser(null);
        return;
      }

      let stored: StoredSession;
      try {
        const parsed: unknown = JSON.parse(serialized);
        if (
          typeof parsed !== "object" ||
          parsed === null ||
          typeof (parsed as StoredSession).accessToken !== "string" ||
          typeof (parsed as StoredSession).refreshToken !== "string"
        ) {
          throw new Error("Stored authentication session is invalid.");
        }
        stored = parsed as StoredSession;
      } catch {
        sessionRef.current = null;
        await AsyncStorage.removeItem(STORAGE_KEY);
        setSession(null);
        setUser(null);
        return;
      }

      sessionRef.current = stored;
      const currentToken = (await refreshAccessToken()) ?? stored.accessToken;
      let currentUser: AuthUser;
      try {
        currentUser = await authService.getMe(currentToken);
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) throw error;
        const refreshedToken = await refreshAccessToken(stored.accessToken);
        if (!refreshedToken || refreshedToken === currentToken) throw error;
        currentUser = await authService.getMe(refreshedToken);
      }

      const activeSession = sessionRef.current ?? stored;
      setSession(activeSession);
      setUser(currentUser);
      if (!appRoleFromAuthRoles(currentUser.roles)) {
        setAuthError(new Error("Tài khoản chưa được cấp vai trò sử dụng ứng dụng."));
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        sessionRef.current = null;
        setSession(null);
        setUser(null);
        await AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
      } else {
        setSession(sessionRef.current);
        setUser(null);
      }
      setAuthError(error);
    } finally {
      setIsLoading(false);
    }
  }, [refreshAccessToken]);

  const retrySession = useCallback(async () => {
    setIsLoading(true);
    setAuthError(null);
    await restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    setUnauthorizedTokenRefreshHandler(refreshAccessToken);
    return () => setUnauthorizedTokenRefreshHandler(null);
  }, [refreshAccessToken]);

  useEffect(() => {
    if (!session) return;
    const delay = scheduledRefreshDelay(session);
    if (delay === null) return;

    const timer = setTimeout(() => {
      void refreshAccessToken().catch(() => undefined);
    }, delay);
    return () => clearTimeout(timer);
  }, [refreshAccessToken, session]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshAccessToken().catch(() => undefined);
    });
    return () => subscription.remove();
  }, [refreshAccessToken]);

  useEffect(() => {
    void Promise.resolve().then(() => restoreSession());
  }, [restoreSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const tokens = await authService.login(email.trim(), password);
      const nextSession = toStoredSession(tokens);
      sessionRef.current = nextSession;

      const currentUser = await authService.getMe(nextSession.accessToken);
      if (!appRoleFromAuthRoles(currentUser.roles)) {
        throw new Error("Tài khoản chưa được cấp vai trò sử dụng ứng dụng.");
      }

      const activeSession = sessionRef.current ?? nextSession;
      await persistSession(activeSession);
      setSession(activeSession);
      setUser(currentUser);
    } catch (error) {
      if (sessionRef.current?.accessToken) {
        sessionRef.current = null;
        setSession(null);
        setUser(null);
        await AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
      }
      setAuthError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signInWithGoogle = useCallback((query: GoogleOidcCallback) => {
    const existingAttempt = googleOidcAttempts.get(query.state);
    if (existingAttempt) return existingAttempt;

    const attempt = (async (): Promise<RoleId> => {
      setIsLoading(true);
      setAuthError(null);
      try {
        const tokens = await authService.exchangeGoogleOidcCode(query);
        const nextSession = toStoredSession(tokens);
        sessionRef.current = nextSession;

        const currentUser = await authService.getMe(nextSession.accessToken);
        const nextRole = appRoleFromAuthRoles(currentUser.roles);
        if (!nextRole) {
          throw new Error("Tài khoản chưa được cấp vai trò sử dụng ứng dụng.");
        }

        const activeSession = sessionRef.current ?? nextSession;
        await persistSession(activeSession);
        setSession(activeSession);
        setUser(currentUser);
        return nextRole;
      } catch (error) {
        if (sessionRef.current?.accessToken) {
          sessionRef.current = null;
          setSession(null);
          setUser(null);
          await AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
        }
        setAuthError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    })();

    googleOidcAttempts.set(query.state, attempt);
    while (googleOidcAttempts.size > 8) {
      const oldestState = googleOidcAttempts.keys().next().value;
      if (!oldestState) break;
      googleOidcAttempts.delete(oldestState);
    }
    return attempt;
  }, []);

  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      // Wait for a rotating refresh token to settle, then revoke the newest one.
      await refreshPromiseRef.current?.catch(() => null);
      const refreshToken = sessionRef.current?.refreshToken;
      if (refreshToken) await authService.logout(refreshToken).catch(() => undefined);
    } finally {
      sessionRef.current = null;
      await AsyncStorage.removeItem(STORAGE_KEY);
      setSession(null);
      setUser(null);
      setAuthError(null);
      setIsLoading(false);
    }
  }, []);

  const role = useMemo(() => (user ? appRoleFromAuthRoles(user.roles) : null), [user]);
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token: session?.accessToken ?? null,
      role,
      isAuthenticated: Boolean(user && session?.accessToken && role),
      isLoading,
      authError,
      signIn,
      signInWithGoogle,
      signOut,
      retrySession,
    }),
    [user, session, role, isLoading, authError, signIn, signInWithGoogle, signOut, retrySession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}

async function persistSession(session: StoredSession): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function toStoredSession(tokens: AuthTokens): StoredSession {
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: Date.now() + tokens.expiresIn * 1000,
    expiresIn: tokens.expiresIn,
  };
}

function shouldRefreshSession(session: StoredSession, now = Date.now()): boolean {
  if (!Number.isFinite(session.expiresAt)) return true;
  const lifetimeMs = Number.isFinite(session.expiresIn) ? session.expiresIn! * 1000 : null;
  const refreshWindowMs =
    lifetimeMs === null ? 60_000 : Math.min(60_000, Math.max(2_000, lifetimeMs * 0.2));
  return session.expiresAt - now <= refreshWindowMs;
}

function scheduledRefreshDelay(session: StoredSession, now = Date.now()): number | null {
  if (!Number.isFinite(session.expiresAt)) return 0;
  const lifetimeMs = Number.isFinite(session.expiresIn) ? session.expiresIn! * 1000 : null;
  if (lifetimeMs !== null && lifetimeMs <= 15_000) return null;
  const refreshWindowMs =
    lifetimeMs === null ? 60_000 : Math.min(60_000, Math.max(2_000, lifetimeMs * 0.2));
  return Math.max(0, session.expiresAt - now - refreshWindowMs);
}

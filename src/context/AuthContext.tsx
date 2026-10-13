import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { ApiError } from "@/services/api-client";
import { authService, type AuthTokens, type AuthUser } from "@/services/auth.service";
import { appRoleFromAuthRoles } from "@/features/auth/role-mapper";
import type { RoleId } from "@/types/raceos";

const STORAGE_KEY = "raceos.auth.session.v1";

type StoredSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  role: RoleId | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: unknown;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  retrySession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<StoredSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<unknown>(null);

  const restoreSession = useCallback(async () => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const serialized = await AsyncStorage.getItem(STORAGE_KEY);
      if (!serialized) {
        setSession(null);
        setUser(null);
        return;
      }

      let stored: StoredSession;
      try {
        stored = JSON.parse(serialized) as StoredSession;
      } catch {
        await AsyncStorage.removeItem(STORAGE_KEY);
        setSession(null);
        setUser(null);
        return;
      }

      try {
        const currentUser = await authService.getMe(stored.accessToken);
        setSession(stored);
        setUser(currentUser);
        if (!appRoleFromAuthRoles(currentUser.roles)) {
          setAuthError(new Error("Tài khoản chưa được cấp vai trò sử dụng ứng dụng."));
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401 && stored.refreshToken) {
          try {
            const refreshed = await authService.refresh(stored.refreshToken);
            const nextSession = toStoredSession(refreshed);
            const currentUser = await authService.getMe(nextSession.accessToken);
            await persistSession(nextSession);
            setSession(nextSession);
            setUser(currentUser);
            if (!appRoleFromAuthRoles(currentUser.roles)) {
              setAuthError(new Error("Tài khoản chưa được cấp vai trò sử dụng ứng dụng."));
            }
            return;
          } catch (refreshError) {
            if (!(refreshError instanceof ApiError) || refreshError.status !== 401) {
              setSession(stored);
              setUser(null);
              setAuthError(refreshError);
              return;
            }
          }
          await AsyncStorage.removeItem(STORAGE_KEY);
          setSession(null);
          setUser(null);
          return;
        }

        setSession(stored);
        setUser(null);
        setAuthError(error);
      }
    } catch (error) {
      setSession(null);
      setUser(null);
      setAuthError(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const tokens = await authService.login(email.trim(), password);
      const nextSession = toStoredSession(tokens);
      const currentUser = await authService.getMe(nextSession.accessToken);
      if (!appRoleFromAuthRoles(currentUser.roles)) {
        throw new Error("Tài khoản chưa được cấp vai trò sử dụng ứng dụng.");
      }
      await persistSession(nextSession);
      setSession(nextSession);
      setUser(currentUser);
    } catch (error) {
      setAuthError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    const refreshToken = session?.refreshToken;
    setIsLoading(true);
    try {
      if (refreshToken) await authService.logout(refreshToken).catch(() => undefined);
    } finally {
      await AsyncStorage.removeItem(STORAGE_KEY);
      setSession(null);
      setUser(null);
      setAuthError(null);
      setIsLoading(false);
    }
  }, [session?.refreshToken]);

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
      signOut,
      retrySession: restoreSession,
    }),
    [user, session, role, isLoading, authError, signIn, signOut, restoreSession],
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
  };
}

import { useCallback, useMemo, useState, type ReactNode } from "react";
import * as api from "../lib/api";
import type { AuthPortal, User } from "../types";
import { AuthContext } from "./auth-context";

function readStoredUser() {
  const saved = localStorage.getItem("garda_user");
  return saved ? (JSON.parse(saved) as User) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(readStoredUser);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("garda_token"));
  const [isLoading, setIsLoading] = useState(false);

  const saveSession = useCallback((nextUser: User, nextToken: string) => {
    setUser(nextUser);
    setToken(nextToken);
    localStorage.setItem("garda_user", JSON.stringify(nextUser));
    localStorage.setItem("garda_token", nextToken);
  }, []);

  const signIn = useCallback(async (email: string, password: string, portal: AuthPortal) => {
    setIsLoading(true);
    try {
      const response = await api.login({ email, password, portal });
      saveSession(response.user, response.token);
    } finally {
      setIsLoading(false);
    }
  }, [saveSession]);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await api.register({ name, email, password });
      saveSession(response.user, response.token);
    } finally {
      setIsLoading(false);
    }
  }, [saveSession]);

  const signOut = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("garda_user");
    localStorage.removeItem("garda_token");
  }, []);

  const value = useMemo(
    () => ({ user, token, isLoading, signIn, signUp, signOut }),
    [user, token, isLoading, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}


import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import * as api from "../lib/api";
import type { AuthPortal, User } from "../types";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    // Remove credentials from the previous starter; the API owns the session.
    localStorage.removeItem("garda_user");
    localStorage.removeItem("garda_token");
    api.getCurrentUser()
      .then((current) => { if (active) setUser(current); })
      .catch(() => { if (active) setSessionError("Tidak dapat menghubungi API. Periksa koneksi lalu coba lagi."); })
      .finally(() => { if (active) setIsReady(true); });
    return () => { active = false; };
  }, []);

  const signIn = useCallback(async (email: string, password: string, portal: AuthPortal) => {
    setIsLoading(true);
    try {
      const signedIn = (await api.login({ email, password, portal })).user;
      if (signedIn.role !== portal) {
        await api.logout();
        throw new Error(`Akun ini terdaftar untuk portal ${signedIn.role}, bukan portal ${portal}.`);
      }
      setUser(signedIn);
    }
    finally { setIsLoading(false); }
  }, []);
  const signUp = useCallback(async (name: string, email: string, password: string) => {
    setIsLoading(true);
    try { setUser((await api.register({ name, email, password })).user); }
    finally { setIsLoading(false); }
  }, []);
  const signOut = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);
  const signInGoogle = useCallback(async (portal: AuthPortal) => {
    setIsLoading(true);
    try { await api.signInGoogle(portal); }
    finally { setIsLoading(false); }
  }, []);
  const value = useMemo(
    () => ({ user, isLoading, isReady, sessionError, signIn, signUp, signOut, signInGoogle }),
    [user, isLoading, isReady, sessionError, signIn, signUp, signOut, signInGoogle],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

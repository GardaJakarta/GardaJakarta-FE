import { createContext } from "react";
import type { AuthPortal, User } from "../types";

export interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isReady: boolean;
  sessionError: string | null;
  signIn: (email: string, password: string, portal: AuthPortal) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
  signInGoogle: (portal: AuthPortal) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export interface User {
  id: string;
  name: string;
  email: string;
  role: "warga" | "polisi" | "admin";
}

export type AuthPortal = User["role"];

export interface AuthResponse {
  user: User;
}

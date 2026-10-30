import type { AuthPortal } from "../types";

export const portalPaths = {
  warga: { home: "/dashboard", login: "/login", label: "Warga" },
  polisi: { home: "/dashboard", login: "/polisi/login", label: "Petugas polisi" },
  admin: { home: "/admin", login: "/admin/login", label: "Admin" },
} satisfies Record<AuthPortal, { home: string; login: string; label: string }>;

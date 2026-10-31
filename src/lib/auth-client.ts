import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields, emailOTPClient } from "better-auth/client/plugins";

const apiUrl = new URL(import.meta.env.VITE_API_URL || "/api", window.location.origin);

export const authClient = createAuthClient({
  baseURL: `${apiUrl.href.replace(/\/$/, "")}/auth`,
  fetchOptions: { credentials: "include" },
  plugins: [emailOTPClient(), inferAdditionalFields({ user: { role: { type: "string", input: false } } })],
});

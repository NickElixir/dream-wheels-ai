import { headers } from "next/headers";
import { checkAdminAuth } from "@/lib/admin-auth";

// Defense in depth: never rely on Proxy alone to protect server-rendered data.
export async function requireAdmin(): Promise<void> {
  const requestHeaders = await headers();
  if (checkAdminAuth(requestHeaders.get("authorization")) !== 200) {
    throw new Error("Admin authentication required");
  }
}

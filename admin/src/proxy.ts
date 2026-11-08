import { NextRequest, NextResponse } from "next/server";
import { adminAuthHeaders, checkAdminAuth } from "./lib/admin-auth";

function unauthorized() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Dream Wheels Admin"',
      "Cache-Control": "private, no-store",
    },
  });
}

export function proxy(request: NextRequest) {
  const status = checkAdminAuth(request.headers.get("authorization"));
  if (status === 401) return unauthorized();
  if (status !== 200) {
    return new NextResponse("Admin auth is not configured", { status, headers: adminAuthHeaders(status) });
  }
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

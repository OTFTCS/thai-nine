import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_PATHS = ["/admin", "/api/admin"];
const ADMIN_DIAGNOSTIC_PATHS = ["/api/diagnostic/invites"];

export function middleware(request: NextRequest) {
  const isPublicDeploy = process.env.IS_PUBLIC_DEPLOY === "true";
  if (!isPublicDeploy) return NextResponse.next();

  const { pathname } = request.nextUrl;

  for (const adminPath of ADMIN_PATHS) {
    if (pathname === adminPath || pathname.startsWith(`${adminPath}/`)) {
      return new NextResponse(null, { status: 404 });
    }
  }

  for (const blocked of ADMIN_DIAGNOSTIC_PATHS) {
    if (pathname === blocked) {
      return new NextResponse(null, { status: 404 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/diagnostic/invites",
  ],
};

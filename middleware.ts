import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_COOKIE,
  isValidAdminToken,
  safeNextPath,
} from "@/lib/auth/adminAuth";

// Гейт админки: страницы /admin* и API /api/admin/* — только с валидным
// cookie. Открыты сама форма логина и login/logout (иначе некуда логиниться).
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (pathname === "/api/admin/login" || pathname === "/api/admin/logout") {
    return NextResponse.next();
  }

  const authed = await isValidAdminToken(req.cookies.get(ADMIN_COOKIE)?.value);

  if (pathname === "/admin/login") {
    if (authed) {
      const url = req.nextUrl.clone();
      url.pathname = safeNextPath(req.nextUrl.searchParams.get("next"));
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!authed) {
    // API отвечает статусом, страницы — редиректом на форму логина.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/admin", "/api/admin/:path*"],
};

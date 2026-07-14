import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_COOKIE,
  isValidAdminToken,
  safeNextPath,
} from "@/lib/auth/adminAuth";

// Гейт админки: без валидного cookie — на форму логина. Сам /admin/login
// открыт (иначе некуда логиниться), залогиненного с него уводим в админку.
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
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
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/admin"],
};

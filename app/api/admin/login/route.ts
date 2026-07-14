import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_COOKIE,
  ADMIN_COOKIE_MAX_AGE,
  loginAdmin,
} from "@/lib/auth/adminAuth";

// POST /api/admin/login — проверка логина/пароля, выдача cookie-сессии.
export async function POST(req: NextRequest) {
  let login = "";
  let password = "";
  try {
    const body = await req.json();
    login = typeof body?.login === "string" ? body.login : "";
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const token = await loginAdmin(login.trim(), password);
  if (!token) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_COOKIE_MAX_AGE,
  });
  return res;
}

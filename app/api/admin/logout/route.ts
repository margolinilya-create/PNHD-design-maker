import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/auth/adminAuth";

// POST /api/admin/logout — сброс cookie-сессии админки.
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

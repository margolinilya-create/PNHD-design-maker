import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, loginFromToken } from "@/lib/auth/adminAuth";

// GET /api/admin/me — логин текущей сессии (валидность уже проверил middleware).
export async function GET(req: NextRequest) {
  const login = loginFromToken(req.cookies.get(ADMIN_COOKIE)?.value);
  if (!login) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ login });
}

import { NextResponse, type NextRequest } from "next/server";
import { hashPassword } from "@/lib/auth/hash";
import {
  createUser,
  getUser,
  listUsers,
  UsersDbUnavailable,
} from "@/lib/auth/usersDb";

// Управление пользователями админки. Доступ гейтит middleware.

const MIN_PASSWORD = 4;

function dbError(e: unknown): NextResponse {
  if (e instanceof UsersDbUnavailable) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }
  throw e;
}

// GET /api/admin/users — список (без хэшей).
export async function GET() {
  try {
    return NextResponse.json({ users: await listUsers() });
  } catch (e) {
    return dbError(e);
  }
}

// POST /api/admin/users — создать пользователя { login, password }.
export async function POST(req: NextRequest) {
  let login = "";
  let password = "";
  try {
    const body = await req.json();
    login = typeof body?.login === "string" ? body.login.trim() : "";
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!login) {
    return NextResponse.json({ error: "empty_login" }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD) {
    return NextResponse.json({ error: "short_password" }, { status: 400 });
  }

  try {
    if (await getUser(login)) {
      return NextResponse.json({ error: "login_taken" }, { status: 409 });
    }
    await createUser(login, await hashPassword(password));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return dbError(e);
  }
}

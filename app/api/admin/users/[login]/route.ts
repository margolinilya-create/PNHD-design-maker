import { NextResponse, type NextRequest } from "next/server";
import { hashPassword } from "@/lib/auth/hash";
import {
  countUsers,
  deleteUser,
  getUser,
  updateUser,
  UsersDbUnavailable,
} from "@/lib/auth/usersDb";

// Правка/удаление конкретного пользователя. Доступ гейтит middleware.
// [login] в URL — encodeURIComponent от логина.

const MIN_PASSWORD = 4;

type Params = { params: { login: string } };

function dbError(e: unknown): NextResponse {
  if (e instanceof UsersDbUnavailable) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }
  throw e;
}

// PATCH /api/admin/users/:login — { login?: новый логин, password?: новый пароль }.
export async function PATCH(req: NextRequest, { params }: Params) {
  const login = decodeURIComponent(params.login);
  let newLogin: string | undefined;
  let password: string | undefined;
  try {
    const body = await req.json();
    if (typeof body?.login === "string") newLogin = body.login.trim();
    if (typeof body?.password === "string") password = body.password;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (newLogin === "") {
    return NextResponse.json({ error: "empty_login" }, { status: 400 });
  }
  if (password !== undefined && password.length < MIN_PASSWORD) {
    return NextResponse.json({ error: "short_password" }, { status: 400 });
  }
  if (newLogin === undefined && password === undefined) {
    return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
  }

  try {
    if (!(await getUser(login))) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (newLogin && newLogin !== login && (await getUser(newLogin))) {
      return NextResponse.json({ error: "login_taken" }, { status: 409 });
    }
    const patch: { login?: string; password_hash?: string } = {};
    if (newLogin && newLogin !== login) patch.login = newLogin;
    if (password !== undefined) patch.password_hash = await hashPassword(password);
    if (Object.keys(patch).length > 0) await updateUser(login, patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return dbError(e);
  }
}

// DELETE /api/admin/users/:login — удалить (последнего не даём).
export async function DELETE(_req: NextRequest, { params }: Params) {
  const login = decodeURIComponent(params.login);
  try {
    if (!(await getUser(login))) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if ((await countUsers()) <= 1) {
      return NextResponse.json({ error: "last_user" }, { status: 400 });
    }
    await deleteUser(login);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return dbError(e);
  }
}

// Таблица пользователей админки (pinhead_admin_users) через PostgREST.
//
// Нарочно сырой fetch, а не supabase-js: модуль импортируется middleware
// (edge-runtime), где лишние килобайты и node-зависимости ни к чему.
// Недоступный Supabase — это UsersDbUnavailable, НЕ «пользователь не найден»:
// вызывающий код различает деградацию (bootstrap-вход) и отказ в доступе.

export type AdminUser = {
  login: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
};

/** Публичная запись — без хэша (наружу, в UI). */
export type AdminUserPublic = Omit<AdminUser, "password_hash">;

export class UsersDbUnavailable extends Error {
  constructor(cause?: unknown) {
    super(`users db unavailable: ${String(cause)}`);
  }
}

const TABLE = "pinhead_admin_users";
const TIMEOUT_MS = 4000;

function cfg(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new UsersDbUnavailable("env not configured");
  return { url, key };
}

async function rest(
  query: string,
  init?: RequestInit & { prefer?: string },
): Promise<Response> {
  const { url, key } = cfg();
  let res: Response;
  try {
    res = await fetch(`${url}/rest/v1/${TABLE}${query}`, {
      ...init,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(init?.prefer ? { Prefer: init.prefer } : {}),
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (e) {
    // сеть/таймаут — деградация, а не бизнес-ошибка
    throw new UsersDbUnavailable(e);
  }
  if (!res.ok) {
    // 5xx от PostgREST тоже считаем недоступностью
    if (res.status >= 500) throw new UsersDbUnavailable(`http ${res.status}`);
    throw new Error(`users db: http ${res.status} ${await res.text()}`);
  }
  return res;
}

const eq = (login: string) => `login=eq.${encodeURIComponent(login)}`;

export async function getUser(login: string): Promise<AdminUser | null> {
  const res = await rest(`?${eq(login)}&select=*`);
  const rows = (await res.json()) as AdminUser[];
  return rows[0] ?? null;
}

export async function listUsers(): Promise<AdminUserPublic[]> {
  const res = await rest(
    "?select=login,created_at,updated_at&order=created_at.asc",
  );
  return (await res.json()) as AdminUserPublic[];
}

export async function countUsers(): Promise<number> {
  const res = await rest("?select=login");
  return ((await res.json()) as unknown[]).length;
}

export async function createUser(
  login: string,
  passwordHash: string,
): Promise<void> {
  await rest("", {
    method: "POST",
    body: JSON.stringify({ login, password_hash: passwordHash }),
  });
}

export async function updateUser(
  login: string,
  patch: { login?: string; password_hash?: string },
): Promise<void> {
  await rest(`?${eq(login)}`, {
    method: "PATCH",
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  });
}

export async function deleteUser(login: string): Promise<void> {
  await rest(`?${eq(login)}`, { method: "DELETE" });
}

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bootstrapCredentials,
  bootstrapSessionToken,
  dbSessionToken,
  isValidAdminToken,
  loginAdmin,
  loginFromToken,
} from "./adminAuth";
import {
  decodeLoginB64,
  encodeLoginB64,
  hashPassword,
  verifyPassword,
} from "./hash";
import { safeNextPath } from "./nextPath";
import type { AdminUser } from "./usersDb";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// Мини-эмуляция PostgREST над pinhead_admin_users: достаточно для getUser /
// countUsers / createUser / updateUser / deleteUser из usersDb.ts.
function fakeDb(initial: Array<Pick<AdminUser, "login" | "password_hash">>) {
  const now = "2026-07-14T00:00:00Z";
  const table: AdminUser[] = initial.map((r) => ({
    ...r,
    created_at: now,
    updated_at: now,
  }));

  const fetchImpl = async (input: unknown, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const eqRaw = url.searchParams.get("login"); // "eq.<login>" либо null
    const login = eqRaw?.startsWith("eq.") ? eqRaw.slice(3) : null;
    const match = (r: AdminUser) => login === null || r.login === login;

    if (method === "GET") {
      return Response.json(table.filter(match));
    }
    if (method === "POST") {
      const body = JSON.parse(String(init?.body));
      table.push({ ...body, created_at: now, updated_at: now });
      return Response.json([], { status: 201 });
    }
    if (method === "PATCH") {
      const body = JSON.parse(String(init?.body));
      table.forEach((r, i) => {
        if (match(r)) table[i] = { ...r, ...body };
      });
      return Response.json([]);
    }
    if (method === "DELETE") {
      for (let i = table.length - 1; i >= 0; i--) {
        if (match(table[i])) table.splice(i, 1);
      }
      return Response.json([]);
    }
    return Response.json({ error: "unsupported" }, { status: 400 });
  };

  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://fake.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "fake-key");
  vi.stubGlobal("fetch", fetchImpl);
  return table;
}

describe("hash", () => {
  it("hashPassword/verifyPassword — roundtrip, отказ на чужом пароле", async () => {
    const stored = await hashPassword("секрет-123");
    expect(stored).toMatch(/^[0-9a-f]{32}\$[0-9a-f]{64}$/);
    expect(await verifyPassword("секрет-123", stored)).toBe(true);
    expect(await verifyPassword("другой", stored)).toBe(false);
    expect(await verifyPassword("секрет-123", "мусор")).toBe(false);
  });

  it("соль случайная — два хэша одного пароля различаются, оба валидны", async () => {
    const a = await hashPassword("p");
    const b = await hashPassword("p");
    expect(a).not.toBe(b);
    expect(await verifyPassword("p", a)).toBe(true);
    expect(await verifyPassword("p", b)).toBe(true);
  });

  it("encodeLoginB64/decodeLoginB64 — roundtrip, включая кириллицу и точки", () => {
    for (const s of ["pinhead", "Илья Марголин", "a.b.c", "x:y/z+w="]) {
      expect(decodeLoginB64(encodeLoginB64(s))).toBe(s);
    }
    expect(decodeLoginB64("не-base64url!!!")).toBe(null);
  });
});

describe("режим БД (фейковый PostgREST)", () => {
  it("вход по записи БД: верный пароль — u-токен, неверный — null", async () => {
    const hash = await hashPassword("pw-1234");
    fakeDb([{ login: "ilya", password_hash: hash }]);
    const token = await loginAdmin("ilya", "pw-1234");
    expect(token).toBe(await dbSessionToken("ilya", hash));
    expect(await isValidAdminToken(token!)).toBe(true);
    expect(await loginAdmin("ilya", "wrong")).toBe(null);
  });

  it("самозасев: пустая таблица + встроенные креды → запись создана", async () => {
    const table = fakeDb([]);
    const boot = bootstrapCredentials();
    const token = await loginAdmin(boot.login, boot.password);
    expect(token).toMatch(/^u\./);
    expect(table.map((r) => r.login)).toEqual([boot.login]);
    expect(await verifyPassword(boot.password, table[0].password_hash)).toBe(true);
    expect(await isValidAdminToken(token!)).toBe(true);
  });

  it("встроенные креды НЕ работают, когда таблица непуста", async () => {
    fakeDb([{ login: "ilya", password_hash: await hashPassword("pw-1234") }]);
    const boot = bootstrapCredentials();
    expect(await loginAdmin(boot.login, boot.password)).toBe(null);
  });

  it("смена пароля инвалидирует старую сессию", async () => {
    const hash = await hashPassword("old-pass");
    const table = fakeDb([{ login: "ilya", password_hash: hash }]);
    const token = await loginAdmin("ilya", "old-pass");
    table[0].password_hash = await hashPassword("new-pass");
    expect(await isValidAdminToken(token!)).toBe(false);
    expect(await loginAdmin("ilya", "new-pass")).toBeTruthy();
  });

  it("удаление пользователя инвалидирует сессию; b-токен при живой БД не действует", async () => {
    const hash = await hashPassword("pw-1234");
    fakeDb([{ login: "ilya", password_hash: hash }]);
    const token = await dbSessionToken("ghost", hash);
    expect(await isValidAdminToken(token)).toBe(false);
    const boot = bootstrapCredentials();
    const bToken = await bootstrapSessionToken(boot.login, boot.password);
    expect(await isValidAdminToken(bToken)).toBe(false);
  });
});

describe("деградация (Supabase не настроен/недоступен)", () => {
  // env NEXT_PUBLIC_SUPABASE_* в vitest не заданы → UsersDbUnavailable.
  it("встроенные креды дают b-токен, и он валиден", async () => {
    const boot = bootstrapCredentials();
    const token = await loginAdmin(boot.login, boot.password);
    expect(token).toMatch(/^b\./);
    expect(await isValidAdminToken(token!)).toBe(true);
  });

  it("чужие креды и порченый токен — отказ", async () => {
    expect(await loginAdmin("кто-то", "что-то")).toBe(null);
    const boot = bootstrapCredentials();
    const token = await loginAdmin(boot.login, boot.password);
    expect(await isValidAdminToken(token! + "x")).toBe(false);
    expect(await isValidAdminToken(undefined)).toBe(false);
    expect(await isValidAdminToken("")).toBe(false);
  });

  it("env ADMIN_LOGIN/ADMIN_PASSWORD переопределяют встроенные креды", async () => {
    vi.stubEnv("ADMIN_LOGIN", "boss");
    vi.stubEnv("ADMIN_PASSWORD", "supersecret");
    expect(await loginAdmin("boss", "supersecret")).toMatch(/^b\./);
    expect(await loginAdmin("pinhead", "pnhd-Il2eAA4m")).toBe(null);
  });
});

describe("loginFromToken", () => {
  it("достаёт логин из u- и b-токенов, отбрасывает мусор", async () => {
    expect(loginFromToken(await dbSessionToken("Илья", "h"))).toBe("Илья");
    expect(loginFromToken(await bootstrapSessionToken("x", "y"))).toBe("x");
    expect(loginFromToken("мусор")).toBe(null);
    expect(loginFromToken(undefined)).toBe(null);
    expect(loginFromToken("z.abc.def")).toBe(null);
  });
});

describe("safeNextPath", () => {
  it("пропускает внутренние пути, режет внешние в /admin", () => {
    expect(safeNextPath("/admin?x=1")).toBe("/admin?x=1");
    expect(safeNextPath(null)).toBe("/admin");
    expect(safeNextPath("https://evil.com")).toBe("/admin");
    expect(safeNextPath("//evil.com")).toBe("/admin");
    expect(safeNextPath("admin")).toBe("/admin");
  });
});

import { afterEach, describe, expect, it } from "vitest";
import {
  adminCredentials,
  adminToken,
  checkAdminCredentials,
  expectedAdminToken,
  isValidAdminToken,
} from "./adminAuth";
import { safeNextPath } from "./nextPath";

afterEach(() => {
  delete process.env.ADMIN_LOGIN;
  delete process.env.ADMIN_PASSWORD;
});

describe("adminCredentials", () => {
  it("даёт дефолты без env", () => {
    const { login, password } = adminCredentials();
    expect(login).toBeTruthy();
    expect(password).toBeTruthy();
  });

  it("env переопределяет дефолты", () => {
    process.env.ADMIN_LOGIN = "boss";
    process.env.ADMIN_PASSWORD = "secret";
    expect(adminCredentials()).toEqual({ login: "boss", password: "secret" });
  });

  it("пустая env-переменная не затирает дефолт", () => {
    process.env.ADMIN_LOGIN = "";
    expect(adminCredentials().login).not.toBe("");
  });
});

describe("adminToken", () => {
  it("детерминирован и выглядит как sha256-hex", async () => {
    const a = await adminToken("u", "p");
    const b = await adminToken("u", "p");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("зависит и от логина, и от пароля", async () => {
    const base = await adminToken("u", "p");
    expect(await adminToken("x", "p")).not.toBe(base);
    expect(await adminToken("u", "x")).not.toBe(base);
  });

  it("логин/пароль не склеиваются неоднозначно", async () => {
    // "ab"+"c" vs "a"+"bc" — разделитель обязан различать пары
    expect(await adminToken("ab", "c")).not.toBe(await adminToken("a", "bc"));
  });
});

describe("checkAdminCredentials / isValidAdminToken", () => {
  it("принимает действующую пару и её токен", async () => {
    process.env.ADMIN_LOGIN = "boss";
    process.env.ADMIN_PASSWORD = "secret";
    expect(await checkAdminCredentials("boss", "secret")).toBe(true);
    expect(await isValidAdminToken(await expectedAdminToken())).toBe(true);
  });

  it("отклоняет неверную пару, чужой и пустой токен", async () => {
    process.env.ADMIN_LOGIN = "boss";
    process.env.ADMIN_PASSWORD = "secret";
    expect(await checkAdminCredentials("boss", "wrong")).toBe(false);
    expect(await checkAdminCredentials("", "")).toBe(false);
    expect(await isValidAdminToken(await adminToken("boss", "wrong"))).toBe(
      false,
    );
    expect(await isValidAdminToken(undefined)).toBe(false);
    expect(await isValidAdminToken("")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("пропускает внутренние пути", () => {
    expect(safeNextPath("/admin?x=1")).toBe("/admin?x=1");
    expect(safeNextPath("/editor")).toBe("/editor");
  });

  it("режет внешние и кривые значения в /admin", () => {
    expect(safeNextPath(null)).toBe("/admin");
    expect(safeNextPath(undefined)).toBe("/admin");
    expect(safeNextPath("")).toBe("/admin");
    expect(safeNextPath("https://evil.com")).toBe("/admin");
    expect(safeNextPath("//evil.com")).toBe("/admin");
    expect(safeNextPath("admin")).toBe("/admin");
  });
});

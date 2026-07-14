// Авторизация админки: логин/пароль → HttpOnly-cookie со stateless-токеном.
//
// Токен = SHA-256(login \n password \n соль-версии). Middleware на каждый
// запрос пересчитывает ожидаемый токен и сравнивает с cookie — ни БД, ни
// серверных сессий не нужно. Смена логина/пароля автоматически инвалидирует
// все выданные cookie (токен меняется).
//
// Модуль исполняется и в edge-runtime (middleware), и в node (route handlers),
// и в vitest — поэтому только Web Crypto, без node:crypto.
// ВАЖНО: не импортировать в клиентские компоненты — дефолтные учётные данные
// не должны попадать в браузерный бандл (клиенту — lib/auth/nextPath.ts).

export { safeNextPath } from "./nextPath";

/** Имя cookie с токеном админ-сессии. */
export const ADMIN_COOKIE = "pnhd_admin_token";

/** Срок жизни сессии, сек (30 дней). */
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

// Соль версии токена: смена строки разлогинит всех.
const TOKEN_SALT = "pnhd-admin-v1";

// Дефолтные учётные данные — для внутреннего инструмента осознанно лежат в
// коде (репозиторий приватный, как и .env.production с ключами Supabase).
// Переопределяются переменными окружения ADMIN_LOGIN / ADMIN_PASSWORD
// (на Vercel env-переменные проекта имеют приоритет над кодом).
const DEFAULT_LOGIN = "pinhead";
const DEFAULT_PASSWORD = "pnhd-Il2eAA4m";

/** Действующие учётные данные (env поверх дефолтов). */
export function adminCredentials(): { login: string; password: string } {
  return {
    login: process.env.ADMIN_LOGIN || DEFAULT_LOGIN,
    password: process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD,
  };
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Токен для пары логин/пароль (не обязательно действующей). */
export async function adminToken(
  login: string,
  password: string,
): Promise<string> {
  return sha256Hex(`${login}\n${password}\n${TOKEN_SALT}`);
}

/** Ожидаемый токен действующих учётных данных. */
export async function expectedAdminToken(): Promise<string> {
  const { login, password } = adminCredentials();
  return adminToken(login, password);
}

/** Проверка пары логин/пароль против действующих учётных данных. */
export async function checkAdminCredentials(
  login: string,
  password: string,
): Promise<boolean> {
  // Сравниваем хэши, а не строки: одинаковая длина операндов, меньше
  // сигнала для тайминг-атак, чем у посимвольного сравнения паролей.
  const [given, expected] = await Promise.all([
    adminToken(login, password),
    expectedAdminToken(),
  ]);
  return given === expected;
}

/** Валиден ли токен из cookie. */
export async function isValidAdminToken(
  token: string | undefined,
): Promise<boolean> {
  if (!token) return false;
  return token === (await expectedAdminToken());
}

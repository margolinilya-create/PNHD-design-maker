// Авторизация админки: пользователи в Supabase (pinhead_admin_users),
// HttpOnly-cookie со stateless-токеном, привязанным к логину и хэшу пароля.
//
// Форматы токена:
//   `u.<b64url(login)>.<sha256(login \n password_hash \n соль)>` — обычная
//     сессия по записи в БД. Смена пароля/логина или удаление пользователя
//     инвалидирует его сессии автоматически (токен перестаёт сходиться).
//   `b.<b64url(login)>.<sha256(login \n password \n bootstrap-соль)>` —
//     аварийная сессия по встроенным кредам; принимается ТОЛЬКО пока БД
//     недоступна (Supabase лёг / env не настроен, например `npm run dev`).
//
// Самозасев: пока таблица пуста, вход встроенными кредами создаёт первую
// запись — дальше всё управляется вкладкой «Пользователи». Удалили всех —
// встроенные креды снова оживают (защита от полного локаута).
//
// Модуль исполняется и в edge-runtime (middleware), и в node (route handlers),
// и в vitest — поэтому только Web Crypto, без node:crypto.
// ВАЖНО: не импортировать в клиентские компоненты — встроенные учётные данные
// не должны попадать в браузерный бандл (клиенту — lib/auth/nextPath.ts).

import {
  decodeLoginB64,
  encodeLoginB64,
  hashPassword,
  sha256Hex,
  verifyPassword,
} from "./hash";
import {
  countUsers,
  createUser,
  getUser,
  UsersDbUnavailable,
} from "./usersDb";

export { safeNextPath } from "./nextPath";

/** Имя cookie с токеном админ-сессии. */
export const ADMIN_COOKIE = "pnhd_admin_token";

/** Срок жизни сессии, сек (30 дней). */
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

// Соль версии токена: смена строки разлогинит всех.
const TOKEN_SALT = "pnhd-admin-v2";

// Встроенные (bootstrap) учётные данные — вход при пустой таблице или лежащем
// Supabase. Для внутреннего инструмента осознанно в коде (репозиторий
// приватный); переопределяются env ADMIN_LOGIN / ADMIN_PASSWORD на Vercel.
const DEFAULT_LOGIN = "pinhead";
const DEFAULT_PASSWORD = "pnhd-Il2eAA4m";

/** Встроенные учётные данные (env поверх дефолтов). */
export function bootstrapCredentials(): { login: string; password: string } {
  return {
    login: process.env.ADMIN_LOGIN || DEFAULT_LOGIN,
    password: process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD,
  };
}

/** Токен сессии по записи БД. */
export async function dbSessionToken(
  login: string,
  passwordHash: string,
): Promise<string> {
  const hash = await sha256Hex(`${login}\n${passwordHash}\n${TOKEN_SALT}`);
  return `u.${encodeLoginB64(login)}.${hash}`;
}

/** Аварийный токен по встроенным кредам (валиден только без БД). */
export async function bootstrapSessionToken(
  login: string,
  password: string,
): Promise<string> {
  const hash = await sha256Hex(`${login}\n${password}\nbootstrap\n${TOKEN_SALT}`);
  return `b.${encodeLoginB64(login)}.${hash}`;
}

/** Логин из значения cookie (без проверки валидности). */
export function loginFromToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || (parts[0] !== "u" && parts[0] !== "b")) return null;
  return decodeLoginB64(parts[1]);
}

/**
 * Вход по логину/паролю. Возвращает значение для cookie или null (не пустил).
 * Порядок: запись в БД → самозасев встроенными кредами при пустой таблице →
 * (только если БД недоступна) аварийный bootstrap-вход.
 */
export async function loginAdmin(
  login: string,
  password: string,
): Promise<string | null> {
  const boot = bootstrapCredentials();
  try {
    const user = await getUser(login);
    if (user) {
      return (await verifyPassword(password, user.password_hash))
        ? dbSessionToken(user.login, user.password_hash)
        : null;
    }
    if (
      login === boot.login &&
      password === boot.password &&
      (await countUsers()) === 0
    ) {
      const passwordHash = await hashPassword(password);
      await createUser(login, passwordHash);
      return dbSessionToken(login, passwordHash);
    }
    return null;
  } catch (e) {
    if (e instanceof UsersDbUnavailable) {
      return login === boot.login && password === boot.password
        ? bootstrapSessionToken(login, password)
        : null;
    }
    throw e;
  }
}

/** Валиден ли токен из cookie (ходит в БД за актуальным хэшем). */
export async function isValidAdminToken(
  token: string | undefined,
): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const login = decodeLoginB64(parts[1]);
  if (login === null) return false;

  if (parts[0] === "u") {
    try {
      const user = await getUser(login);
      if (!user) return false;
      return token === (await dbSessionToken(user.login, user.password_hash));
    } catch (e) {
      // БД лежит — обычные сессии временно не проверить; не пускаем
      // (аварийный вход по встроенным кредам остаётся доступен).
      if (e instanceof UsersDbUnavailable) return false;
      throw e;
    }
  }

  if (parts[0] === "b") {
    const boot = bootstrapCredentials();
    if (login !== boot.login) return false;
    try {
      await getUser(login);
      // БД доступна — аварийные сессии не действуют, вход штатный.
      return false;
    } catch (e) {
      if (e instanceof UsersDbUnavailable) {
        return token === (await bootstrapSessionToken(boot.login, boot.password));
      }
      throw e;
    }
  }

  return false;
}

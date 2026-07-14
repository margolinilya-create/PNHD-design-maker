// Криптопримитивы авторизации: только Web Crypto (edge / node / vitest).
//
// Пароли храним как `saltHex$hashHex`, где hash = PBKDF2-SHA256(password,
// salt, 100k итераций). Соль случайная per-user и живёт в той же строке —
// переименование логина НЕ инвалидирует хэш (соль не зависит от логина).

const PBKDF2_ITERATIONS = 100_000;

function toHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return toHex(digest);
}

async function pbkdf2Hex(password: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: enc.encode(saltHex),
      iterations: PBKDF2_ITERATIONS,
    },
    key,
    256,
  );
  return toHex(bits);
}

/** Захэшировать пароль для хранения (`saltHex$hashHex`). */
export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const saltHex = toHex(salt);
  return `${saltHex}$${await pbkdf2Hex(password, saltHex)}`;
}

/** Проверить пароль против сохранённого `saltHex$hashHex`. */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [saltHex, hashHex] = stored.split("$");
  if (!saltHex || !hashHex) return false;
  return (await pbkdf2Hex(password, saltHex)) === hashHex;
}

/** base64url для логина в cookie (логин может содержать что угодно). */
export function encodeLoginB64(login: string): string {
  const bytes = new TextEncoder().encode(login);
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeLoginB64(b64url: string): string | null {
  try {
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

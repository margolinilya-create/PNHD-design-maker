// Клиент-безопасная часть авторизации: без учётных данных и секретов.
// Импортируется страницей логина — держать отдельно от adminAuth.ts,
// чтобы дефолтный пароль не попал в браузерный бандл.

/**
 * Безопасный путь возврата после логина: только внутренний absolute-path
 * (защита от open redirect через ?next=https://evil).
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/admin";
  return next;
}

"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Pencil, Plus, Trash2, UserRound } from "lucide-react";

// Вкладка «Пользователи»: список аккаунтов админки, добавление, смена
// логина/пароля, удаление. Работает через /api/admin/users (гейт middleware).
//
// Сессии привязаны к логину и хэшу пароля: правка ЧУЖОГО аккаунта просто
// разлогинит его владельца. Смену СВОЕГО пароля дожимаем тихим re-login
// (новый пароль знаем), после смены своего логина честно уводим на форму.

type UserRow = { login: string; created_at: string; updated_at: string };

type EditState =
  | { login: string; mode: "password"; value: string }
  | { login: string; mode: "rename"; value: string }
  | null;

const ERRORS: Record<string, string> = {
  empty_login: "Логин пустой",
  short_password: "Пароль короче 4 символов",
  login_taken: "Такой логин уже есть",
  not_found: "Пользователь не найден (обнови список)",
  last_user: "Нельзя удалить последнего пользователя",
  db_unavailable: "Supabase недоступен — управление пользователями не работает",
  unauthorized: "Сессия истекла — войди заново",
};

function apiError(body: unknown, fallback: string): string {
  const code =
    body && typeof body === "object" && "error" in body
      ? String((body as { error: unknown }).error)
      : "";
  return ERRORS[code] ?? fallback;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export function UsersPanel() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [newLogin, setNewLogin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [edit, setEdit] = useState<EditState>(null);

  const load = useCallback(async (isAlive: () => boolean = () => true) => {
    try {
      const [usersRes, meRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/me"),
      ]);
      const usersBody = await usersRes.json();
      const meBody = await meRes.json();
      if (!isAlive()) return;
      if (!usersRes.ok) {
        setErr(apiError(usersBody, "Не удалось загрузить пользователей"));
        setUsers(null);
        return;
      }
      setErr(null);
      setUsers(usersBody.users as UserRow[]);
      setMe(meRes.ok ? (meBody.login as string) : null);
    } catch {
      if (isAlive()) setErr("Сеть недоступна");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    load(() => alive);
    return () => {
      alive = false;
    };
  }, [load]);

  // Обёртка мутаций: индикатор занятости + перезагрузка списка + вывод ошибки.
  const run = async (fn: () => Promise<string | null>) => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    setNotice(null);
    try {
      const notice = await fn();
      setNotice(notice);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const addUser = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: newLogin, password: newPassword }),
      });
      if (!res.ok) throw new Error(apiError(await res.json(), "Не удалось добавить"));
      setNewLogin("");
      setNewPassword("");
      return `Пользователь «${newLogin.trim()}» добавлен`;
    });
  };

  const submitEdit = (e: FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    const { login, mode, value } = edit;
    const isSelf = login === me;

    if (mode === "rename" && isSelf) {
      const ok = window.confirm(
        "Ты меняешь СВОЙ логин — текущая сессия закроется, придётся войти заново. Продолжить?",
      );
      if (!ok) return;
    }

    run(async () => {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(login)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "rename" ? { login: value } : { password: value },
        ),
      });
      if (!res.ok) throw new Error(apiError(await res.json(), "Не удалось сохранить"));
      setEdit(null);

      if (isSelf && mode === "password") {
        // Свой пароль сменили — тихо перевыпускаем cookie новым паролем.
        await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ login, password: value }),
        });
        return "Твой пароль обновлён, сессия перевыпущена";
      }
      if (isSelf && mode === "rename") {
        router.replace("/admin/login");
        return null;
      }
      return mode === "rename"
        ? `Логин «${login}» → «${value.trim()}» (его сессии закрыты)`
        : `Пароль «${login}» обновлён (его сессии закрыты)`;
    });
  };

  const remove = (login: string) => {
    const isSelf = login === me;
    const ok = window.confirm(
      isSelf
        ? "Ты удаляешь СВОЙ аккаунт — сессия закроется, войти получится только под другим пользователем. Продолжить?"
        : `Удалить пользователя «${login}»? Его сессии закроются.`,
    );
    if (!ok) return;
    run(async () => {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(login)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(apiError(await res.json(), "Не удалось удалить"));
      if (isSelf) {
        router.replace("/admin/login");
        return null;
      }
      return `Пользователь «${login}» удалён`;
    });
  };

  const input =
    "rounded border border-line bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-blue-500";
  const iconBtn =
    "inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 hover:bg-raised hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <div className="mx-auto w-full max-w-2xl p-4">
      <p className="mb-4 text-xs text-gray-500">
        Все пользователи равноправны — каждый видит витрину, редактор и
        админку. Смена логина или пароля закрывает сессии этого пользователя
        на всех устройствах.
      </p>

      {/* Добавление */}
      <form
        onSubmit={addUser}
        className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white p-3 shadow-sm"
      >
        <input
          value={newLogin}
          onChange={(e) => setNewLogin(e.target.value)}
          placeholder="Логин"
          autoComplete="off"
          className={`w-40 ${input}`}
        />
        <input
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Пароль (мин. 4)"
          type="text"
          autoComplete="off"
          className={`w-44 ${input}`}
        />
        <button
          type="submit"
          disabled={busy || !newLogin.trim() || newPassword.length < 4}
          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={14} strokeWidth={1.75} /> Добавить
        </button>
      </form>

      {err && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {err}
        </div>
      )}
      {notice && (
        <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {notice}
        </div>
      )}

      {/* Список */}
      {users === null && !err && (
        <p className="text-sm text-gray-500">Загрузка…</p>
      )}
      {users !== null && users.length === 0 && (
        <p className="text-sm text-gray-500">
          Пользователей пока нет — вход работает по встроенному доступу.
          Добавь первого (или просто перезайди: встроенный доступ сам станет
          первым пользователем).
        </p>
      )}
      <ul className="space-y-2">
        {(users ?? []).map((u) => {
          const isSelf = u.login === me;
          const editing = edit?.login === u.login ? edit : null;
          return (
            <li
              key={u.login}
              className="rounded-lg border border-line bg-white p-3 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-raised text-gray-500">
                  <UserRound size={14} strokeWidth={1.75} />
                </span>
                <span className="text-sm font-semibold text-ink">
                  {u.login}
                </span>
                {isSelf && (
                  <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-700">
                    это ты
                  </span>
                )}
                <span className="ml-auto text-[11px] text-gray-400">
                  создан {fmtDate(u.created_at)}
                  {u.updated_at !== u.created_at &&
                    ` · изменён ${fmtDate(u.updated_at)}`}
                </span>
              </div>

              <div className="mt-2 flex items-center gap-1">
                <button
                  onClick={() =>
                    setEdit(
                      editing?.mode === "password"
                        ? null
                        : { login: u.login, mode: "password", value: "" },
                    )
                  }
                  disabled={busy}
                  className={iconBtn}
                >
                  <KeyRound size={13} strokeWidth={1.75} /> пароль
                </button>
                <button
                  onClick={() =>
                    setEdit(
                      editing?.mode === "rename"
                        ? null
                        : { login: u.login, mode: "rename", value: u.login },
                    )
                  }
                  disabled={busy}
                  className={iconBtn}
                >
                  <Pencil size={13} strokeWidth={1.75} /> логин
                </button>
                <button
                  onClick={() => remove(u.login)}
                  disabled={busy || (users ?? []).length <= 1}
                  title={
                    (users ?? []).length <= 1
                      ? "Последнего пользователя удалить нельзя"
                      : undefined
                  }
                  className={`${iconBtn} hover:text-red-700`}
                >
                  <Trash2 size={13} strokeWidth={1.75} /> удалить
                </button>
              </div>

              {editing && (
                <form
                  onSubmit={submitEdit}
                  className="mt-2 flex flex-wrap items-center gap-2 border-t border-line-soft pt-2"
                >
                  <input
                    value={editing.value}
                    onChange={(e) =>
                      setEdit({ ...editing, value: e.target.value })
                    }
                    placeholder={
                      editing.mode === "password" ? "Новый пароль (мин. 4)" : "Новый логин"
                    }
                    type="text"
                    autoComplete="off"
                    autoFocus
                    className={`w-56 ${input}`}
                  />
                  <button
                    type="submit"
                    disabled={
                      busy ||
                      (editing.mode === "password"
                        ? editing.value.length < 4
                        : !editing.value.trim() ||
                          editing.value.trim() === u.login)
                    }
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Сохранить
                  </button>
                  <button
                    type="button"
                    onClick={() => setEdit(null)}
                    className="text-xs text-gray-400 hover:text-gray-700"
                  >
                    отмена
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

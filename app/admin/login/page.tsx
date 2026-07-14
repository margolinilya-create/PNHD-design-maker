"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Lock } from "lucide-react";
import { safeNextPath } from "@/lib/auth/nextPath";

// Форма входа в админку. Сюда редиректит middleware; после успешного логина
// возвращаем на исходный адрес (?next=...), по умолчанию — /admin.
function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });
      if (res.ok) {
        router.replace(safeNextPath(params.get("next")));
        router.refresh();
        return;
      }
      setError(
        res.status === 401
          ? "Неверный логин или пароль"
          : "Не получилось войти, попробуй ещё раз",
      );
    } catch {
      setError("Сеть недоступна, попробуй ещё раз");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-sm rounded-lg border border-line bg-white p-6 shadow-sm"
    >
      <div className="mb-5 flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-raised text-ink">
          <Lock size={15} strokeWidth={1.75} />
        </span>
        <div>
          <div className="text-sm font-semibold text-ink">Вход в админку</div>
          <div className="text-xs text-gray-500">PINHEAD · управление SKU</div>
        </div>
      </div>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs text-gray-500">Логин</span>
        <input
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          autoComplete="username"
          autoFocus
          className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-blue-500"
        />
      </label>

      <label className="mb-4 block">
        <span className="mb-1 block text-xs text-gray-500">Пароль</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-blue-500"
        />
      </label>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy || !login || !password}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Проверяю…" : "Войти"}
      </button>

      <Link
        href="/"
        className="mt-4 inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700"
      >
        <ChevronLeft size={14} strokeWidth={1.75} /> На главную
      </Link>
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-shell px-6">
      {/* useSearchParams требует Suspense-границу при пререндере */}
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}

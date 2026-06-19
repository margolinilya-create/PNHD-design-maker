"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ChevronLeft,
  Check,
  TriangleAlert,
  Ban,
  X,
  Cloud,
  Plus,
} from "lucide-react";

/**
 * Витрина дизайн-системы «Студия» — живой справочник токенов и компонентов
 * для команды. Не часть продакшн-флоу: чистая визуальная документация того,
 * что реально используется в редакторе/админке/тех-листе.
 */
export default function StyleguidePage() {
  const [modal, setModal] = useState(false);
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-10 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            Дизайн-система «Студия»
          </h1>
          <p className="mt-1 text-gray-500">
            Живой справочник токенов и компонентов PINHEAD. Светлый шелл, белые
            панели, синий акцент, мягкие тени.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-ink hover:border-blue-500 hover:bg-white"
        >
          <ChevronLeft size={16} strokeWidth={1.75} />
          На главную
        </Link>
      </header>

      {/* Поверхности */}
      <Section title="Поверхности" hint="Слои фона — от шелла к приподнятым панелям.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Swatch name="shell" cls="bg-shell" />
          <Swatch name="paper" cls="bg-paper" />
          <Swatch name="raised" cls="bg-raised" />
          <Swatch name="sunken" cls="bg-sunken" />
          <Swatch name="line" cls="bg-line" />
        </div>
      </Section>

      {/* Акценты */}
      <Section title="Акценты" hint="Семантические цвета действий и статусов (дефолты Tailwind).">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Swatch name="blue-600" cls="bg-blue-600" dark />
          <Swatch name="blue-700" cls="bg-blue-700" dark />
          <Swatch name="emerald-600" cls="bg-emerald-600" dark />
          <Swatch name="green-600" cls="bg-green-600" dark />
          <Swatch name="amber-600" cls="bg-amber-600" dark />
          <Swatch name="rose-600" cls="bg-rose-600" dark />
        </div>
      </Section>

      {/* Типографика */}
      <Section title="Типографика">
        <div className="rounded-xl border border-line bg-paper p-5 shadow-sm">
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            Заголовок H1
          </h1>
          <h2 className="mt-2 text-xl font-semibold text-ink">Заголовок H2</h2>
          <h3 className="mt-2 font-semibold text-ink">Подзаголовок H3</h3>
          <p className="mt-2 text-sm text-gray-700">
            Основной текст — gray-700. Используется в телах панелей и модалок.
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Вторичный/подпись — gray-500.
          </p>
          <p className="mt-1 text-xs text-gray-400">Хинт/плейсхолдер — gray-400.</p>
          <p className="pnhd-tabular mt-2 text-sm text-ink">
            Метрика: 280×360 мм · 300 DPI · ±3 мм
          </p>
        </div>
      </Section>

      {/* Кнопки */}
      <Section title="Кнопки">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-paper p-5 shadow-sm">
          <button className="rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
            Экспорт PDF (1:1)
          </button>
          <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Действие
          </button>
          <button className="rounded-lg border border-emerald-600 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100">
            Batch PDF
          </button>
          <button className="rounded-lg bg-raised px-3 py-2 text-sm font-medium text-ink hover:bg-gray-200">
            Вторичная
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-ink hover:border-blue-500 hover:bg-white">
            <Plus size={16} strokeWidth={1.75} />
            С иконкой
          </button>
          <button
            disabled
            className="rounded-lg bg-raised px-3 py-2 text-sm font-medium text-ink opacity-50"
          >
            Заблокирована
          </button>
        </div>
      </Section>

      {/* Чипы и статусы */}
      <Section title="Чипы и статусы">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-paper p-5 shadow-sm">
          <span className="rounded bg-raised px-2 py-0.5 text-xs text-gray-700">
            front
          </span>
          <span className="rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white">
            Активен
          </span>
          <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">
            <Cloud size={12} strokeWidth={1.75} />
            моя
          </span>
          <StatusChip kind="draft" />
          <StatusChip kind="approved" />
          <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
            <TriangleAlert size={13} strokeWidth={1.75} />
            предупреждение
          </span>
          <span className="inline-flex items-center gap-1 rounded bg-red-50 px-2 py-1 text-xs text-red-700">
            <Ban size={13} strokeWidth={1.75} />
            блокирует
          </span>
        </div>
      </Section>

      {/* Поля ввода */}
      <Section title="Поля ввода">
        <div className="grid max-w-md gap-3 rounded-xl border border-line bg-paper p-5 shadow-sm">
          <label className="text-xs text-gray-500">
            Клиент
            <input
              placeholder="Название…"
              className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-blue-500"
            />
          </label>
          <label className="text-xs text-gray-500">
            Метод печати
            <select className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-blue-500">
              <option>DTF-трансфер</option>
              <option>Шелкография</option>
              <option>Вышивка</option>
            </select>
          </label>
        </div>
      </Section>

      {/* Модалка */}
      <Section title="Модальное окно" hint="Шапка с × и линией, тело, sunken-футер.">
        <button
          onClick={() => setModal(true)}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Открыть модалку
        </button>
        {modal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(17,24,39,0.45)] p-4"
            onClick={() => setModal(false)}
          >
            <div
              className="flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-line bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <header className="flex items-center justify-between gap-3 border-b border-line-soft px-3.5 py-3">
                <h3 className="text-sm font-semibold text-ink">Заголовок модалки</h3>
                <button
                  onClick={() => setModal(false)}
                  aria-label="Закрыть"
                  className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-raised hover:text-ink"
                >
                  <X size={16} strokeWidth={1.75} />
                </button>
              </header>
              <div className="px-3.5 py-3 text-sm text-gray-700">
                Тело модалки. Сюда идёт контент — чеклист, таблица, список
                размеров. Прокрутка при переполнении.
              </div>
              <footer className="flex justify-end gap-2 border-t border-line-soft bg-sunken px-3.5 py-3">
                <button
                  onClick={() => setModal(false)}
                  className="rounded bg-raised px-3 py-1.5 text-sm text-ink hover:bg-gray-200"
                >
                  Отмена
                </button>
                <button
                  onClick={() => setModal(false)}
                  className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  Подтвердить
                </button>
              </footer>
            </div>
          </div>
        )}
      </Section>

      {/* Конвенции линий чертежа */}
      <Section
        title="Конвенции линий (тех-лист)"
        hint="Палитра канваса и векторного PDF — единый язык чертежа."
      >
        <div className="grid gap-2 rounded-xl border border-line bg-paper p-5 shadow-sm sm:grid-cols-2">
          <LineRow color="#2563eb" dash label="Печатная зона" />
          <LineRow color="#16a34a" dash label="Безопасная зона (safe-inset)" />
          <LineRow color="#94a3b8" label="Размерная линия (мм)" />
          <LineRow color="#d97706" label="Линейка / измерение" />
          <LineRow color="#2563eb" label="Ось симметрии" />
          <Dot color="#e11d48" label="Якорь (горловина / центр)" />
          <Dot color="#e11d48" label="Выход за зону" />
        </div>
      </Section>

      {/* Тени */}
      <Section title="Тени">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "shadow-sm", cls: "shadow-sm" },
            { label: "shadow-md", cls: "shadow-md" },
            { label: "shadow-lg", cls: "shadow-lg" },
            { label: "shadow-xl", cls: "shadow-xl" },
          ].map((s) => (
            <div
              key={s.cls}
              className={`flex h-20 items-center justify-center rounded-xl border border-line bg-paper text-xs text-gray-500 ${s.cls}`}
            >
              {s.label}
            </div>
          ))}
        </div>
      </Section>

      <p className="mt-12 text-xs text-gray-400">
        Источник правды — <code className="text-gray-500">design-system/</code> и{" "}
        <code className="text-gray-500">app/globals.css</code>.
      </p>
    </main>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {hint && <p className="mb-3 mt-0.5 text-sm text-gray-500">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </section>
  );
}

function Swatch({ name, cls, dark }: { name: string; cls: string; dark?: boolean }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-paper shadow-sm">
      <div className={`h-14 ${cls}`} />
      <div
        className={`px-2 py-1.5 text-[11px] ${dark ? "text-gray-600" : "text-gray-600"}`}
      >
        {name}
      </div>
    </div>
  );
}

function StatusChip({ kind }: { kind: "draft" | "approved" }) {
  return kind === "approved" ? (
    <span className="inline-flex items-center gap-1 rounded bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
      <Check size={13} strokeWidth={2} />
      Согласовано
    </span>
  ) : (
    <span className="rounded bg-raised px-2 py-1 text-xs font-medium text-gray-600">
      Черновик
    </span>
  );
}

function LineRow({
  color,
  label,
  dash,
}: {
  color: string;
  label: string;
  dash?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 text-sm text-gray-700">
      <svg width="56" height="12" className="shrink-0">
        <line
          x1="2"
          y1="6"
          x2="54"
          y2="6"
          stroke={color}
          strokeWidth="1.5"
          strokeDasharray={dash ? "6 4" : undefined}
        />
      </svg>
      {label}
    </div>
  );
}

function Dot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-gray-700">
      <svg width="56" height="12" className="shrink-0">
        <circle cx="28" cy="6" r="4" fill={color} />
      </svg>
      {label}
    </div>
  );
}

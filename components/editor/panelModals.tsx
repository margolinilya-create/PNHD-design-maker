"use client";

import { useMemo } from "react";
import { reviewGrading } from "@/lib/geometry/gradingReview";
import {
  hasBlockingErrors,
  type PreflightIssue,
} from "@/lib/export/preflight";
import type { Placement, View } from "@/types";
import { X, TriangleAlert, Ban, Check } from "lucide-react";

/**
 * Общая обёртка модалки в стиле DS «Студия»: scrim + белая карточка с шапкой
 * (заголовок + ×, нижняя линия), прокручиваемым телом и sunken-футером.
 */
export function Modal({
  title,
  onClose,
  footer,
  maxW = "max-w-md",
  children,
}: {
  title: string;
  onClose: () => void;
  footer?: React.ReactNode;
  maxW?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(17,24,39,0.45)] p-4"
      onClick={onClose}
    >
      <div
        className={`flex max-h-[80vh] w-full ${maxW} flex-col overflow-hidden rounded-xl border border-line bg-white shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-line-soft px-3.5 py-3">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-raised hover:text-ink"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </header>
        <div className="overflow-y-auto px-3.5 py-3 text-sm text-gray-700">
          {children}
        </div>
        {footer && (
          <footer className="flex justify-end gap-2 border-t border-line-soft bg-sunken px-3.5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

/** Модалка «Проверка ростовки» (P1 #12): свод по всем размерам. */
export function GradingReviewModal({
  view,
  placements,
  sizes,
  fromSize,
  onClose,
  onPickSize,
}: {
  view: View;
  placements: Placement[];
  sizes: string[];
  fromSize: string;
  onClose: () => void;
  onPickSize: (size: string) => void;
}) {
  const rows = useMemo(
    () => reviewGrading(view, placements, sizes, fromSize),
    [view, placements, sizes, fromSize],
  );
  const names = rows[0]?.items.map((i) => i.name) ?? [];
  return (
    <Modal
      title={`Проверка ростовки · ${view.kind}`}
      onClose={onClose}
      maxW="max-w-lg"
      footer={
        <button
          onClick={onClose}
          className="rounded bg-raised px-3 py-1.5 text-sm text-ink hover:bg-gray-200"
        >
          Закрыть
        </button>
      }
    >
      <p className="mb-3 text-xs text-gray-500">
        Позиции пересчитаны от размера {fromSize} (константа отступа от
        горловины). Красное — выход за зону; число — мин. отступ, мм.
      </p>
      {names.length === 0 ? (
        <p className="text-xs text-gray-500">Нет нанесений на этом виде.</p>
      ) : (
        <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="text-gray-500">
                <th className="py-1 pr-2 text-left font-medium">Размер</th>
                {names.map((n, i) => (
                  <th key={i} className="px-2 py-1 text-left font-medium">
                    {n}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.size}
                  onClick={() => onPickSize(r.size)}
                  title="Открыть этот размер"
                  className={`cursor-pointer border-t border-line hover:bg-line-soft/50 ${
                    r.anyOut ? "bg-red-50" : ""
                  }`}
                >
                  <td className="py-1.5 pr-2 font-medium text-ink">
                    {r.size}
                    {r.size === fromSize && (
                      <span className="ml-1 text-[10px] text-gray-400">
                        эталон
                      </span>
                    )}
                  </td>
                  {r.items.map((it) => (
                    <td
                      key={it.placementId}
                      className={`px-2 py-1.5 tabular-nums ${
                        it.outOfZone ? "text-red-700" : "text-emerald-700"
                      }`}
                    >
                      {it.outOfZone ? (
                        <TriangleAlert size={12} strokeWidth={1.75} className="mr-1 inline align-middle" />
                      ) : (
                        <Check size={12} strokeWidth={2} className="mr-1 inline align-middle" />
                      )}
                      {Math.round(it.minMargin)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

/** Модалка pre-export чеклиста (S1.4). */
export function PreflightModal({
  issues,
  onCancel,
  onProceed,
  onSelect,
}: {
  issues: PreflightIssue[];
  onCancel: () => void;
  onProceed: () => void;
  onSelect: (placementId: string) => void;
}) {
  const blocking = hasBlockingErrors(issues);
  return (
    <Modal
      title="Проверка перед экспортом"
      onClose={onCancel}
      maxW="max-w-md"
      footer={
        <>
          <button
            onClick={onCancel}
            className="rounded bg-raised px-3 py-1.5 text-sm text-ink hover:bg-gray-200"
          >
            {blocking ? "Закрыть" : "Отмена"}
          </button>
          {!blocking && (
            <button
              onClick={onProceed}
              className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Экспортировать всё равно
            </button>
          )}
        </>
      }
    >
      <p className="mb-3 text-xs text-gray-500">
        {blocking
          ? "Есть блокирующая проблема — экспорт невозможен."
          : "Найдены предупреждения. Можно исправить или продолжить."}
      </p>
      <ul className="flex flex-col gap-1.5">
          {issues.map((it, i) => {
            const clickable = !!it.placementId;
            return (
              <li
                key={i}
                onClick={
                  clickable ? () => onSelect(it.placementId!) : undefined
                }
                title={clickable ? "Перейти к нанесению" : undefined}
                className={`rounded px-2 py-1.5 text-xs ${
                  clickable ? "cursor-pointer hover:brightness-125" : ""
                } ${
                  it.level === "error"
                    ? "bg-red-50 text-red-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                <span className="inline-flex items-start gap-1">
                  {it.level === "error" ? (
                    <Ban size={13} strokeWidth={1.75} className="mt-px shrink-0" />
                  ) : (
                    <TriangleAlert size={13} strokeWidth={1.75} className="mt-px shrink-0" />
                  )}
                  {it.message}
                </span>
              </li>
            );
          })}
      </ul>
    </Modal>
  );
}

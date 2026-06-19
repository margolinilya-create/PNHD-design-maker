"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useProjectStore } from "@/lib/state/projectStore";
import {
  listProjects,
  saveProject,
  loadProject,
  deleteProject,
  isCloud,
  type ProjectSnapshot,
} from "@/lib/persistence/projects";
import { useAddArtwork } from "@/lib/hooks/useAddArtwork";
import {
  placementInfo,
  printAreasForSize,
  presetPosition,
  flatForSize,
  type PositionPreset,
} from "@/lib/geometry/view";
import { printQuality } from "@/lib/catalog/dpi";
import {
  PRINT_METHOD_LIST,
  printMethodProfile,
  resolveMethod,
} from "@/lib/catalog/printMethod";
import { buildSceneSvg } from "@/lib/export/buildSceneSvg";
import { buildPreviewSvg } from "@/lib/export/buildPreviewSvg";
import { exportScenesPdf } from "@/lib/export/exportPdf";
import { exportSvgAsPng } from "@/lib/export/exportPng";
import { resolveFlatMarkup } from "@/lib/export/flatMarkup";
import {
  preflight,
  hasBlockingErrors,
  type PreflightIssue,
} from "@/lib/export/preflight";
import { reviewGrading } from "@/lib/geometry/gradingReview";
import { regradePlacementsToSize } from "@/lib/geometry/regradeBatch";
import type { Asset, Placement, View } from "@/types";

export function SidePanel() {
  const sku = useProjectStore((s) => s.currentSku());
  const view = useProjectStore((s) => s.currentView());
  const size = useProjectStore((s) => s.size);
  const placements = useProjectStore((s) => s.placements);
  const selectedId = useProjectStore((s) => s.selectedPlacementId);
  const assets = useProjectStore((s) => s.assets);
  const client = useProjectStore((s) => s.client);
  const orderRef = useProjectStore((s) => s.orderRef);
  const status = useProjectStore((s) => s.status);

  const selectSize = useProjectStore((s) => s.selectSize);
  const addArtwork = useAddArtwork();
  const removePlacement = useProjectStore((s) => s.removePlacement);
  const updatePlacement = useProjectStore((s) => s.updatePlacement);
  const selectPlacement = useProjectStore((s) => s.selectPlacement);
  const setMeta = useProjectStore((s) => s.setMeta);
  const setStatus = useProjectStore((s) => s.setStatus);
  const snapshot = useProjectStore((s) => s.snapshot);
  const restore = useProjectStore((s) => s.restore);
  const duplicatePlacement = useProjectStore((s) => s.duplicatePlacement);
  const reorderPlacement = useProjectStore((s) => s.reorderPlacement);
  const copyPlacementToView = useProjectStore((s) => s.copyPlacementToView);
  const mirrorPlacement = useProjectStore((s) => s.mirrorPlacement);
  const garmentColor = useProjectStore((s) => s.garmentColor);
  const setGarmentColor = useProjectStore((s) => s.setGarmentColor);
  const comments = useProjectStore((s) => s.comments);
  const addComment = useProjectStore((s) => s.addComment);
  const removeComment = useProjectStore((s) => s.removeComment);
  const readOnly = useProjectStore((s) => s.readOnly);
  const setReadOnly = useProjectStore((s) => s.setReadOnly);

  // Сохранение проектов (Supabase или localStorage).
  const [projName, setProjName] = useState("");
  const [projId, setProjId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectSnapshot[]>([]);
  const [pmsg, setPmsg] = useState<string | null>(null);
  const refreshProjects = useCallback(() => {
    listProjects()
      .then(setProjects)
      .catch((e) => setPmsg(String(e)));
  }, []);
  useEffect(() => refreshProjects(), [refreshProjects]);

  const onSaveProject = async () => {
    const id = projId ?? (globalThis.crypto?.randomUUID?.() ?? String(Date.now()));
    const name = projName.trim() || `${sku?.name ?? "Проект"} ${orderRef}`.trim();
    try {
      await saveProject(snapshot(id, name));
      setProjId(id);
      setProjName(name);
      setPmsg(isCloud() ? "Сохранено в облако" : "Сохранено локально");
      refreshProjects();
    } catch (e) {
      setPmsg(`Ошибка сохранения: ${e}`);
    }
  };
  const onOpenProject = async (id: string) => {
    const s = await loadProject(id);
    if (s) {
      restore(s);
      setProjId(s.id);
      setProjName(s.name);
      setPmsg(`Открыт «${s.name}»`);
    }
  };
  const onDeleteProject = async (id: string) => {
    await deleteProject(id);
    if (projId === id) setProjId(null);
    refreshProjects();
  };

  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // Pre-export чеклист (S1.4): список проблем перед сборкой PDF.
  const [preflightIssues, setPreflightIssues] = useState<
    PreflightIssue[] | null
  >(null);
  // Проверка ростовки (P1 #12): свод по всем размерам.
  const [showReview, setShowReview] = useState(false);
  // Batch-PDF по размерам (P1 #20).
  const [showBatch, setShowBatch] = useState(false);

  // Целевая зона для загрузки (мультизонные виды).
  const areas = useMemo(
    () => (view ? printAreasForSize(view, size ?? undefined) : []),
    [view, size],
  );
  const [targetAreaId, setTargetAreaId] = useState<string | null>(null);
  useEffect(() => {
    // Сброс выбора зоны при смене вида / отсутствии текущей зоны.
    if (!areas.some((a) => a.id === targetAreaId)) {
      setTargetAreaId(areas[0]?.id ?? null);
    }
  }, [areas, targetAreaId]);
  const activeAreaId = targetAreaId ?? areas[0]?.id ?? null;

  // Выбранное нанесение — для точного позиционирования в мм.
  const selectedPlacement = useMemo(
    () => placements.find((p) => p.id === selectedId) ?? null,
    [placements, selectedId],
  );

  const onUpload = async (file: File) => {
    if (!view) return;
    await addArtwork(file, { areaId: activeAreaId ?? undefined });
  };

  // Чистое превью текущего вида → PNG (для клиента).
  const onExportPng = async () => {
    if (!sku || !view) return;
    setBusy(true);
    setMsg(null);
    try {
      const markup = await resolveFlatMarkup(flatForSize(view, size ?? undefined));
      const s = view.scale_mm_per_unit ?? 1;
      const raw = svgSizeMm(markup);
      const vp = placements.filter((p) =>
        view.print_areas.some((a) => a.id === p.print_area_id),
      );
      // Фото-мокап (если у вида есть фото), иначе — чистый флэт.
      let mockup;
      if (view.mockup) {
        const ph = await loadPhoto(view.mockup.photo);
        mockup = { dataUrl: ph.dataUrl, imgW: ph.w, imgH: ph.h, print: view.mockup.print };
      }
      const svg = buildPreviewSvg({
        view,
        flatSvgMarkup: markup,
        flatMm: { w: raw.w * s, h: raw.h * s },
        scaleMmPerUnit: s,
        garmentColor,
        size: size ?? undefined,
        placements: vp,
        assets,
        mockup,
      });
      await exportSvgAsPng(
        svg,
        `${sku.id}-${view.kind}-preview.png`,
        mockup ? 1 : 3,
      );
      setMsg(mockup ? "Фото-мокап готов" : "PNG-превью готов");
    } catch (e) {
      setMsg(`Ошибка превью: ${e}`);
    } finally {
      setBusy(false);
    }
  };

  // Batch-PDF: тех-листы по выбранным размерам в один файл (P1 #20).
  const onExportBatch = async (sizesSel: string[]) => {
    if (!sku || sizesSel.length === 0) return;
    setShowBatch(false);
    setBusy(true);
    setMsg(null);
    try {
      const fromSize = size ?? sku.base_size;
      const scenes: string[] = [];
      for (const tSize of sizesSel) {
        const pls = regradePlacementsToSize(
          sku.views,
          placements,
          fromSize,
          tSize,
        );
        const viewsWith = sku.views.filter((v) =>
          pls.some((p) => v.print_areas.some((a) => a.id === p.print_area_id)),
        );
        for (const v of viewsWith) {
          const markup = await resolveFlatMarkup(flatForSize(v, tSize));
          const raw = svgSizeMm(markup);
          const s = v.scale_mm_per_unit ?? 1;
          const vp = pls.filter((p) =>
            v.print_areas.some((a) => a.id === p.print_area_id),
          );
          scenes.push(
            buildSceneSvg({
              sku,
              view: v,
              flatSvgMarkup: markup,
              flatMm: { w: raw.w * s, h: raw.h * s },
              scaleMmPerUnit: s,
              garmentColor,
              placements: vp,
              assets,
              meta: {
                client,
                orderRef,
                size: tSize,
                date: new Date().toLocaleDateString("ru-RU"),
              },
            }),
          );
        }
      }
      if (!scenes.length) {
        setMsg("Нет нанесений для batch");
        return;
      }
      await exportScenesPdf(scenes, `${sku.id}-batch-${orderRef || "draft"}.pdf`);
      setMsg(`Batch PDF готов (${sizesSel.length} разм.)`);
    } catch (e) {
      setMsg(`Ошибка batch: ${e}`);
    } finally {
      setBusy(false);
    }
  };

  // Гейт перед экспортом: прогоняем чеклист, при проблемах — модалка.
  const onExport = () => {
    if (!sku) return;
    const issues = preflight({
      views: sku.views,
      placements,
      assets,
      size: size ?? undefined,
    });
    if (issues.length > 0) {
      setPreflightIssues(issues);
      return;
    }
    void runExport();
  };

  const runExport = async () => {
    if (!sku) return;
    setPreflightIssues(null);
    setBusy(true);
    setMsg(null);
    try {
      const viewsWithPlacements = sku.views.filter((v) =>
        placements.some((p) =>
          v.print_areas.some((a) => a.id === p.print_area_id),
        ),
      );
      const target = viewsWithPlacements.length ? viewsWithPlacements : [];
      if (!target.length) {
        setMsg("Нет нанесений для экспорта");
        return;
      }
      const scenes: string[] = [];
      for (const v of target) {
        const markup = await resolveFlatMarkup(flatForSize(v, size ?? undefined));
        // Габариты viewBox — в единицах SVG; переводим в мм через scale_mm_per_unit.
        const raw = svgSizeMm(markup);
        const s = v.scale_mm_per_unit ?? 1;
        const flatMm = { w: raw.w * s, h: raw.h * s };
        const vp = placements.filter((p) =>
          v.print_areas.some((a) => a.id === p.print_area_id),
        );
        scenes.push(
          buildSceneSvg({
            sku,
            view: v,
            flatSvgMarkup: markup,
            flatMm,
            scaleMmPerUnit: s,
            garmentColor,
            placements: vp,
            assets,
            meta: {
              client,
              orderRef,
              size: size ?? sku.base_size,
              date: new Date().toLocaleDateString("ru-RU"),
            },
          }),
        );
      }
      await exportScenesPdf(
        scenes,
        `${sku.id}-${orderRef || "draft"}.pdf`,
      );
      setMsg("PDF готов");
    } catch (e) {
      setMsg(`Ошибка экспорта: ${e}`);
    } finally {
      setBusy(false);
    }
  };

  if (!sku || !view) return null;

  // Нанесения текущего вида (порядок массива = z-order).
  const viewLayers = placements.filter((p) =>
    view.print_areas.some((a) => a.id === p.print_area_id),
  );

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-4 text-sm">
      <div className="flex items-center justify-between rounded-lg bg-neutral-800/60 px-3 py-2">
        <span className="text-xs text-neutral-300">
          {readOnly ? "👁 Просмотр (правки заблокированы)" : "✏ Редактирование"}
        </span>
        <button
          onClick={() => setReadOnly(!readOnly)}
          className={`rounded px-2.5 py-1 text-xs ${
            readOnly
              ? "bg-blue-600 text-white"
              : "bg-neutral-700 text-neutral-200 hover:bg-neutral-600"
          }`}
        >
          {readOnly ? "Включить правки" : "Только просмотр"}
        </button>
      </div>

      {!readOnly && (
      <section>
        <h3 className="mb-2 font-semibold text-neutral-200">Макет</h3>
        <input
          ref={fileRef}
          type="file"
          accept=".svg,.png,image/svg+xml,image/png"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = "";
          }}
        />
        {areas.length > 1 && (
          <div className="mb-2">
            <label className="mb-1 block text-xs text-neutral-400">Зона</label>
            <div className="flex flex-wrap gap-1.5">
              {areas.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setTargetAreaId(a.id)}
                  className={`rounded px-2.5 py-1 text-xs ${
                    a.id === activeAreaId
                      ? "bg-blue-600 text-white"
                      : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                  }`}
                >
                  {a.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full rounded-lg bg-blue-600 px-3 py-2 font-medium text-white hover:bg-blue-500"
        >
          Загрузить SVG / PNG
        </button>
        <p className="mt-1 text-xs text-neutral-500">
          Добавится в зону «
          {areas.find((a) => a.id === activeAreaId)?.name ??
            view.print_areas[0].name}
          » текущего вида.
        </p>
      </section>
      )}

      <section>
        <h3 className="mb-2 font-semibold text-neutral-200">Размер (эталон)</h3>
        <div className="flex flex-wrap gap-1.5">
          {sku.sizes.map((sz) => (
            <button
              key={sz}
              onClick={() => selectSize(sz)}
              className={`rounded px-2.5 py-1 ${
                sz === size
                  ? "bg-blue-600 text-white"
                  : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              }`}
            >
              {sz}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          Отступ от горловины — константа на всех размерах (регрейдинг по
          per-size якорям).
        </p>
      </section>

      <section>
        <h3 className="mb-2 font-semibold text-neutral-200">Цвет изделия</h3>
        <div className="flex items-center gap-1.5">
          {["", "#ffffff", "#1b1f24", "#3b4a6b", "#7a2230", "#2f5233", "#c9c4b8"].map(
            (c) => (
              <button
                key={c || "none"}
                onClick={() => setGarmentColor(c)}
                title={c || "без цвета (как на лекале)"}
                className={`h-6 w-6 rounded-full border ${
                  garmentColor === c ? "border-blue-500 ring-1 ring-blue-500" : "border-neutral-600"
                } ${!c ? "bg-neutral-900 text-[9px] text-neutral-500" : ""}`}
                style={c ? { background: c } : undefined}
              >
                {!c ? "—" : ""}
              </button>
            ),
          )}
          <input
            type="color"
            value={garmentColor || "#1b1f24"}
            onChange={(e) => setGarmentColor(e.target.value)}
            title="Свой цвет"
            className="h-6 w-8 cursor-pointer rounded border border-neutral-600 bg-transparent"
          />
        </div>
      </section>

      <section>
        <h3 className="mb-2 font-semibold text-neutral-200">Слои (этот вид)</h3>
        <div className="flex flex-col gap-1.5">
          {viewLayers.length === 0 && (
            <p className="text-xs text-neutral-500">Пока пусто.</p>
          )}
          {/* Сверху — верхний слой (конец массива = выше по z-order). */}
          {[...viewLayers].reverse().map((p) => (
            <LayerRow
              key={p.id}
              placement={p}
              view={view}
              asset={assets[p.asset_id]}
              garmentSize={size}
              selected={p.id === selectedId}
              readOnly={readOnly}
              onSelect={() => selectPlacement(p.id)}
              onRemove={() => removePlacement(p.id)}
              onDup={() => duplicatePlacement(p.id)}
              onUp={() => reorderPlacement(p.id, 1)}
              onDown={() => reorderPlacement(p.id, -1)}
              onToggleHidden={() => updatePlacement(p.id, { hidden: !p.hidden })}
              onToggleLocked={() => updatePlacement(p.id, { locked: !p.locked })}
              onRename={(name) => updatePlacement(p.id, { name })}
            />
          ))}
        </div>
      </section>

      {selectedPlacement && !readOnly && (
        <PlacementInspector
          placement={selectedPlacement}
          view={findViewForPlacement(sku.views, selectedPlacement)}
          views={sku.views}
          garmentSize={size}
          asset={assets[selectedPlacement.asset_id]}
          onChange={(patch) => updatePlacement(selectedPlacement.id, patch)}
          onDuplicate={() => duplicatePlacement(selectedPlacement.id)}
          onCopyToView={(vid) => copyPlacementToView(selectedPlacement.id, vid)}
          onMirror={() => mirrorPlacement(selectedPlacement.id)}
        />
      )}

      <section>
        <h3 className="mb-2 font-semibold text-neutral-200">Проект</h3>
        <label className="mb-1 block text-xs text-neutral-400">Клиент</label>
        <input
          value={client}
          onChange={(e) => setMeta({ client: e.target.value })}
          className="mb-2 w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5"
        />
        <label className="mb-1 block text-xs text-neutral-400">Заказ №</label>
        <input
          value={orderRef}
          onChange={(e) => setMeta({ orderRef: e.target.value })}
          className="mb-2 w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5"
        />
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400">Статус:</span>
          <button
            onClick={() =>
              setStatus(status === "draft" ? "approved" : "draft")
            }
            className={`rounded px-2.5 py-1 text-xs ${
              status === "approved"
                ? "bg-green-600 text-white"
                : "bg-neutral-700 text-neutral-200"
            }`}
          >
            {status === "approved" ? "Согласовано" : "Черновик"}
          </button>
        </div>

        {/* Комментарии согласования (P1 #24) */}
        <div className="mt-3 border-t border-neutral-800 pt-3">
          <span className="mb-1 block text-xs text-neutral-400">
            Согласование ({comments.length})
          </span>
          <CommentBox onAdd={(role, text) => addComment({ role, text })} />
          {comments.length > 0 && (
            <div className="mt-2 flex max-h-44 flex-col gap-1.5 overflow-y-auto">
              {comments.map((c) => (
                <div
                  key={c.id}
                  className="rounded bg-neutral-800/60 px-2 py-1.5 text-xs"
                >
                  <div className="mb-0.5 flex items-center justify-between">
                    <span
                      className={`rounded px-1 text-[10px] ${
                        c.role === "client"
                          ? "bg-blue-950 text-blue-300"
                          : "bg-emerald-950 text-emerald-300"
                      }`}
                    >
                      {c.role === "client" ? "Клиент" : "Цех"}
                    </span>
                    <button
                      onClick={() => removeComment(c.id)}
                      className="text-neutral-600 hover:text-red-400"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="whitespace-pre-wrap text-neutral-200">{c.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Сохранение проекта */}
        <div className="mt-3 border-t border-neutral-800 pt-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-neutral-400">Проекты</span>
            <span className="text-[10px] text-neutral-600">
              {isCloud() ? "☁ облако" : "💾 локально"}
            </span>
          </div>
          <div className="mb-2 flex gap-2">
            <input
              value={projName}
              onChange={(e) => setProjName(e.target.value)}
              placeholder="Название проекта"
              className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5"
            />
            <button
              onClick={onSaveProject}
              className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
            >
              {projId ? "Сохранить" : "Сохранить"}
            </button>
          </div>
          {projects.length > 0 && (
            <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between rounded px-2 py-1 text-xs ${
                    p.id === projId ? "bg-neutral-800" : "hover:bg-neutral-800/60"
                  }`}
                >
                  <button
                    onClick={() => onOpenProject(p.id)}
                    className="min-w-0 flex-1 truncate text-left text-neutral-200"
                    title={p.name}
                  >
                    {p.name || "(без названия)"}
                  </button>
                  <button
                    onClick={() => onDeleteProject(p.id)}
                    className="ml-2 shrink-0 text-neutral-500 hover:text-red-400"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          {pmsg && <p className="mt-1 text-[11px] text-neutral-500">{pmsg}</p>}
        </div>
      </section>

      <section className="mt-auto space-y-2">
        <button
          onClick={() => setShowReview(true)}
          disabled={viewLayers.length === 0}
          className="w-full rounded-lg bg-neutral-800 px-3 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-700 disabled:opacity-50"
        >
          Проверка ростовки
        </button>
        <button
          onClick={onExportPng}
          disabled={busy}
          className="w-full rounded-lg bg-neutral-700 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-600 disabled:opacity-50"
        >
          Превью для клиента (PNG)
        </button>
        <button
          onClick={onExport}
          disabled={busy}
          className="w-full rounded-lg bg-emerald-600 px-3 py-2.5 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? "Сборка…" : "Экспорт PDF (1:1)"}
        </button>
        <button
          onClick={() => setShowBatch(true)}
          disabled={busy || viewLayers.length === 0}
          className="w-full rounded-lg bg-emerald-900/70 px-3 py-2 text-sm font-medium text-emerald-100 hover:bg-emerald-800/70 disabled:opacity-50"
        >
          Batch PDF (по размерам)
        </button>
        {msg && <p className="mt-2 text-xs text-neutral-400">{msg}</p>}
      </section>

      {preflightIssues && (
        <PreflightModal
          issues={preflightIssues}
          onCancel={() => setPreflightIssues(null)}
          onProceed={() => void runExport()}
          onSelect={(pid) => {
            selectPlacement(pid);
            setPreflightIssues(null);
          }}
        />
      )}

      {showReview && (
        <GradingReviewModal
          view={view}
          placements={placements}
          sizes={sku.sizes}
          fromSize={size ?? sku.base_size}
          onClose={() => setShowReview(false)}
          onPickSize={(sz) => {
            selectSize(sz);
            setShowReview(false);
          }}
        />
      )}

      {showBatch && (
        <BatchModal
          sizes={sku.sizes}
          baseSize={size ?? sku.base_size}
          onClose={() => setShowBatch(false)}
          onBuild={(sel) => void onExportBatch(sel)}
        />
      )}
    </div>
  );
}

/** Модалка выбора размеров для batch-PDF (P1 #20). */
function BatchModal({
  sizes,
  baseSize,
  onClose,
  onBuild,
}: {
  sizes: string[];
  baseSize: string;
  onClose: () => void;
  onBuild: (selected: string[]) => void;
}) {
  const [sel, setSel] = useState<Set<string>>(() => new Set(sizes));
  const toggle = (sz: string) =>
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(sz)) next.delete(sz);
      else next.add(sz);
      return next;
    });
  const ordered = sizes.filter((s) => sel.has(s));
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-neutral-700 bg-neutral-900 p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 font-semibold text-neutral-100">
          Batch PDF по размерам
        </h3>
        <p className="mb-3 text-xs text-neutral-500">
          Один файл с тех-листами по выбранным ростовкам (позиции пересчитаны от{" "}
          {baseSize}).
        </p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {sizes.map((sz) => (
            <button
              key={sz}
              onClick={() => toggle(sz)}
              className={`rounded px-2.5 py-1 text-xs ${
                sel.has(sz)
                  ? "bg-blue-600 text-white"
                  : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              }`}
            >
              {sz}
            </button>
          ))}
        </div>
        <div className="flex justify-between gap-2">
          <button
            onClick={() => setSel(new Set(sizes))}
            className="rounded bg-neutral-800 px-2.5 py-1.5 text-xs text-neutral-300 hover:bg-neutral-700"
          >
            Все
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded bg-neutral-700 px-3 py-1.5 text-sm text-neutral-100 hover:bg-neutral-600"
            >
              Отмена
            </button>
            <button
              onClick={() => onBuild(ordered)}
              disabled={ordered.length === 0}
              className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Собрать ({ordered.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Модалка «Проверка ростовки» (P1 #12): свод по всем размерам. */
function GradingReviewModal({
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-900 p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 font-semibold text-neutral-100">
          Проверка ростовки · {view.kind}
        </h3>
        <p className="mb-3 text-xs text-neutral-500">
          Позиции пересчитаны от размера {fromSize} (константа отступа от
          горловины). Красное — выход за зону; число — мин. отступ, мм.
        </p>
        {names.length === 0 ? (
          <p className="text-xs text-neutral-500">Нет нанесений на этом виде.</p>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="text-neutral-400">
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
                  className={`cursor-pointer border-t border-neutral-800 hover:bg-neutral-800/50 ${
                    r.anyOut ? "bg-red-950/30" : ""
                  }`}
                >
                  <td className="py-1.5 pr-2 font-medium text-neutral-200">
                    {r.size}
                    {r.size === fromSize && (
                      <span className="ml-1 text-[10px] text-neutral-500">
                        эталон
                      </span>
                    )}
                  </td>
                  {r.items.map((it) => (
                    <td
                      key={it.placementId}
                      className={`px-2 py-1.5 tabular-nums ${
                        it.outOfZone ? "text-red-300" : "text-emerald-300"
                      }`}
                    >
                      {it.outOfZone ? "⚠ " : "✓ "}
                      {Math.round(it.minMargin)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded bg-neutral-700 px-3 py-1.5 text-sm text-neutral-100 hover:bg-neutral-600"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

/** Модалка pre-export чеклиста (S1.4). */
function PreflightModal({
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
    >
      <div
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-900 p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 font-semibold text-neutral-100">
          Проверка перед экспортом
        </h3>
        <p className="mb-3 text-xs text-neutral-500">
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
                    ? "bg-red-950/70 text-red-300"
                    : "bg-amber-950/50 text-amber-200"
                }`}
              >
                {it.level === "error" ? "⛔ " : "⚠ "}
                {it.message}
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded bg-neutral-700 px-3 py-1.5 text-sm text-neutral-100 hover:bg-neutral-600"
          >
            {blocking ? "Закрыть" : "Отмена"}
          </button>
          {!blocking && (
            <button
              onClick={onProceed}
              className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Экспортировать всё равно
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Форма добавления комментария согласования (P1 #24). */
function CommentBox({
  onAdd,
}: {
  onAdd: (role: "client" | "shop", text: string) => void;
}) {
  const [role, setRole] = useState<"client" | "shop">("shop");
  const [text, setText] = useState("");
  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onAdd(role, t);
    setText("");
  };
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1.5">
        {(["shop", "client"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`rounded px-2 py-0.5 text-[11px] ${
              role === r
                ? "bg-blue-600 text-white"
                : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
            }`}
          >
            {r === "client" ? "Клиент" : "Цех"}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Комментарий…"
          className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs"
        />
        <button
          onClick={submit}
          className="shrink-0 rounded bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
        >
          +
        </button>
      </div>
    </div>
  );
}

function findViewForPlacement(views: View[], p: Placement): View | undefined {
  return views.find((v) => v.print_areas.some((a) => a.id === p.print_area_id));
}

function findViewForPlacementName(view: View | undefined, p: Placement): string {
  return (
    p.name ||
    view?.print_areas.find((a) => a.id === p.print_area_id)?.name ||
    "Слой"
  );
}

/** Строка слоя: превью, имя, DPI, порядок/скрыть/блок/дубль/удалить. */
function LayerRow({
  placement: p,
  view,
  asset,
  garmentSize,
  selected,
  readOnly,
  onSelect,
  onRemove,
  onDup,
  onUp,
  onDown,
  onToggleHidden,
  onToggleLocked,
  onRename,
}: {
  placement: Placement;
  view: View | undefined;
  asset: Asset | undefined;
  garmentSize: string | null;
  selected: boolean;
  readOnly?: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onDup: () => void;
  onUp: () => void;
  onDown: () => void;
  onToggleHidden: () => void;
  onToggleLocked: () => void;
  onRename: (name: string) => void;
}) {
  const out = useMemo(
    () =>
      view
        ? placementInfo(
            view,
            { x: p.x_mm, y: p.y_mm, w: p.width_mm, h: p.height_mm },
            p.rotation_deg,
            garmentSize ?? undefined,
            p.print_area_id,
          ).check.out_of_zone
        : false,
    [view, p.x_mm, p.y_mm, p.width_mm, p.height_mm, p.rotation_deg, p.print_area_id, garmentSize],
  );
  const areaDefault = view?.print_areas.find(
    (a) => a.id === p.print_area_id,
  )?.default_method;
  const method = resolveMethod(p.method, areaDefault);
  const profile = printMethodProfile(method);
  const { quality, dpi } = printQuality(asset, p.width_mm, method);
  const dpiColor =
    quality === "low" ? "text-red-400" : quality === "mid" ? "text-amber-400" : "text-neutral-500";
  const qualityLabel =
    quality === "vector"
      ? "вектор"
      : quality === "embroidery"
        ? "деталь"
        : dpi
          ? `${Math.round(dpi)}dpi`
          : "";

  const icon = "rounded px-1.5 py-0.5 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200";
  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer rounded-lg border p-2 transition ${
        selected ? "border-blue-500 bg-neutral-800" : "border-neutral-700 bg-neutral-900 hover:border-neutral-600"
      } ${p.hidden ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset?.data_url}
          alt=""
          className="h-8 w-8 shrink-0 rounded bg-neutral-950 object-contain"
        />
        <input
          value={findViewForPlacementName(view, p)}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onRename(e.target.value)}
          readOnly={readOnly}
          className="min-w-0 flex-1 bg-transparent text-sm text-neutral-200 outline-none focus:rounded focus:bg-neutral-950 focus:px-1"
        />
        <span
          className="shrink-0 rounded bg-neutral-800 px-1 text-[9px] text-neutral-400"
          title={profile.label}
        >
          {profile.short}
        </span>
        <span className={`shrink-0 text-[10px] tabular-nums ${dpiColor}`}>
          {qualityLabel}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-0.5 text-xs">
        {!readOnly && (
          <>
            <button onClick={(e) => { e.stopPropagation(); onUp(); }} title="Выше" className={icon}>▲</button>
            <button onClick={(e) => { e.stopPropagation(); onDown(); }} title="Ниже" className={icon}>▼</button>
            <button onClick={(e) => { e.stopPropagation(); onToggleHidden(); }} title="Скрыть" className={icon}>{p.hidden ? "🙈" : "👁"}</button>
            <button onClick={(e) => { e.stopPropagation(); onToggleLocked(); }} title="Блокировать" className={icon}>{p.locked ? "🔒" : "🔓"}</button>
            <button onClick={(e) => { e.stopPropagation(); onDup(); }} title="Дублировать" className={icon}>⎘</button>
            <button onClick={(e) => { e.stopPropagation(); onRemove(); }} title="Удалить" className={`${icon} hover:text-red-400`}>✕</button>
          </>
        )}
        {out && <span className="ml-auto rounded bg-red-950 px-1 text-[10px] text-red-300">за зоной</span>}
      </div>
    </div>
  );
}

/**
 * Точное позиционирование выбранного нанесения: числовые поля в мм/градусах
 * с двусторонней привязкой к updatePlacement.
 */
function PlacementInspector({
  placement: p,
  view,
  views,
  garmentSize,
  asset,
  onChange,
  onDuplicate,
  onCopyToView,
  onMirror,
}: {
  placement: Placement;
  view: View | undefined;
  views: View[];
  garmentSize: string | null;
  asset: Asset | undefined;
  onChange: (patch: Partial<Placement>) => void;
  onDuplicate: () => void;
  onCopyToView: (viewId: string) => void;
  onMirror: () => void;
}) {
  const isSleeve = view?.kind === "sleeve_left" || view?.kind === "sleeve_right";
  const otherViews = views.filter((v) => v.id !== view?.id);
  const areaDefault = view?.print_areas.find(
    (a) => a.id === p.print_area_id,
  )?.default_method;
  const method = resolveMethod(p.method, areaDefault);
  const profile = printMethodProfile(method);
  const applyPreset = (preset: PositionPreset) => {
    if (!view) return;
    const pos = presetPosition(
      view,
      { x: p.x_mm, y: p.y_mm, w: p.width_mm, h: p.height_mm },
      preset,
      garmentSize ?? undefined,
      p.print_area_id,
    );
    onChange(pos);
  };
  const isFrontBack =
    view?.kind === "front" || view?.kind === "back";
  const presets: { key: PositionPreset; label: string }[] = [
    { key: "center-x", label: "Центр X" },
    { key: "center-zone", label: "Центр зоны" },
    { key: "top", label: "Вверх" },
    { key: "bottom", label: "Вниз" },
    // Стандарты от горловины — только для front/back.
    ...(isFrontBack
      ? ([
          { key: "chest-standard", label: "Грудь (3″)" },
          { key: "left-chest", label: "Лев. грудь" },
        ] as { key: PositionPreset; label: string }[])
      : []),
  ];
  return (
    <section>
      <h3 className="mb-2 font-semibold text-neutral-200">Позиция (мм)</h3>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {presets.map((pr) => (
          <button
            key={pr.key}
            onClick={() => applyPreset(pr.key)}
            className="rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-700"
          >
            {pr.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MmField
          label="X"
          value={p.x_mm}
          onCommit={(v) => onChange({ x_mm: v })}
        />
        <MmField
          label="Y"
          value={p.y_mm}
          onCommit={(v) => onChange({ y_mm: v })}
        />
        <MmField
          label="Ширина"
          value={p.width_mm}
          min={1}
          onCommit={(v) => onChange({ width_mm: Math.max(1, v) })}
        />
        <MmField
          label="Высота"
          value={p.height_mm}
          min={1}
          onCommit={(v) => onChange({ height_mm: Math.max(1, v) })}
        />
        <MmField
          label="Поворот°"
          value={p.rotation_deg}
          onCommit={(v) => onChange({ rotation_deg: v })}
        />
      </div>
      {/* Трансформ: флип / поворот на 90° */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button onClick={() => onChange({ flip_h: !p.flip_h })} className={tbtn(p.flip_h)}>Флип ↔</button>
        <button onClick={() => onChange({ flip_v: !p.flip_v })} className={tbtn(p.flip_v)}>Флип ↕</button>
        <button onClick={() => onChange({ rotation_deg: (p.rotation_deg - 90 + 360) % 360 })} className={tbtn(false)}>⟲ 90°</button>
        <button onClick={() => onChange({ rotation_deg: (p.rotation_deg + 90) % 360 })} className={tbtn(false)}>⟳ 90°</button>
      </div>

      {/* Действия: дубль / копия на вид / зеркало рукава */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <button onClick={onDuplicate} className={tbtn(false)}>Дублировать</button>
        {isSleeve && <button onClick={onMirror} className={tbtn(false)}>Зеркало рукава</button>}
        {otherViews.length > 0 && (
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) onCopyToView(e.target.value);
              e.target.value = "";
            }}
            className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200"
          >
            <option value="">Копировать на вид…</option>
            {otherViews.map((v) => (
              <option key={v.id} value={v.id}>{v.kind}</option>
            ))}
          </select>
        )}
      </div>

      {/* Метод печати — задаёт профиль качества и production-вывод */}
      <div className="mt-3 border-t border-neutral-800 pt-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs text-neutral-400">Метод печати</span>
          <span className="text-[10px] text-neutral-500">
            {profile.colorMode === "spot" ? "spot / Pantone" : "CMYK"}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRINT_METHOD_LIST.map((m) => (
            <button
              key={m.id}
              onClick={() => onChange({ method: m.id })}
              title={m.label}
              className={`rounded px-2.5 py-1 text-xs ${
                m.id === method
                  ? "bg-blue-600 text-white"
                  : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Спецификация для цеха: допуск ± и «как мерить» (P1 #13) */}
      <div className="mt-3 border-t border-neutral-800 pt-3">
        <span className="mb-1 block text-xs text-neutral-400">
          Спецификация (печатается в обвязке)
        </span>
        <div className="mb-2 grid grid-cols-2 gap-2">
          <MmField
            label="Допуск ± мм"
            value={p.tolerance_mm ?? 0}
            min={0}
            onCommit={(v) => onChange({ tolerance_mm: v > 0 ? v : undefined })}
          />
        </div>
        <label className="mb-1 block text-xs text-neutral-400">
          Как мерить (HTM)
        </label>
        <input
          value={p.htm ?? ""}
          onChange={(e) => onChange({ htm: e.target.value || undefined })}
          placeholder="напр. от шва горловины до верха принта"
          className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs"
        />
      </div>

      {asset?.size_estimated && (
        <p className="mt-2 rounded bg-amber-950/60 px-2 py-1 text-xs text-amber-300">
          размер оценочно — уточните Ш×В
        </p>
      )}
      <DpiBadge asset={asset} printWidthMm={p.width_mm} method={method} />
    </section>
  );
}

const tbtn = (active?: boolean) =>
  `rounded px-2 py-1 text-xs ${active ? "bg-blue-600 text-white" : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700"}`;

/** Индикатор качества печати на текущем размере макета (с учётом метода). */
function DpiBadge({
  asset,
  printWidthMm,
  method,
}: {
  asset: Asset | undefined;
  printWidthMm: number;
  method?: import("@/types").PrintMethod;
}) {
  const { quality, dpi } = printQuality(asset, printWidthMm, method);
  if (quality === "unknown") return null;
  const profile = printMethodProfile(method);
  if (quality === "embroidery") {
    const d = profile.detail!;
    return (
      <p className="mt-2 rounded bg-sky-950/60 px-2 py-1 text-xs text-sky-300">
        вышивка — проверьте мин. деталь: линия ≥ {d.minLineMm} мм, текст ≥{" "}
        {d.minTextMm} мм (диджитайз вне инструмента)
      </p>
    );
  }
  const good = profile.dpi?.good ?? 300;
  const map: Record<string, { cls: string; text: string }> = {
    vector: {
      cls: "bg-emerald-950/60 text-emerald-300",
      text: "вектор — без потери качества",
    },
    good: {
      cls: "bg-emerald-950/60 text-emerald-300",
      text: `${Math.round(dpi ?? 0)} DPI — отличное качество`,
    },
    mid: {
      cls: "bg-amber-950/60 text-amber-300",
      text: `${Math.round(dpi ?? 0)} DPI — приемлемо (уменьшите макет для ${good}+)`,
    },
    low: {
      cls: "bg-red-950/70 text-red-300",
      text: `${Math.round(dpi ?? 0)} DPI — низкое качество, печать размыта`,
    },
  };
  const m = map[quality];
  return <p className={`mt-2 rounded px-2 py-1 text-xs ${m.cls}`}>{m.text}</p>;
}

/**
 * Числовое поле в мм с локальным буфером ввода:
 * правки фиксируются по blur/Enter, при этом поле синхронизируется,
 * когда значение в сторе меняется извне (drag/стрелки на холсте).
 */
function MmField({
  label,
  value,
  min,
  onCommit,
}: {
  label: string;
  value: number;
  min?: number;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState(() => round1(value));
  const [editing, setEditing] = useState(false);

  // Пока поле не редактируется — следуем за внешним значением.
  useEffect(() => {
    if (!editing) setDraft(round1(value));
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const n = parseFloat(draft.replace(",", "."));
    if (Number.isFinite(n)) {
      onCommit(min != null ? Math.max(min, n) : n);
    } else {
      setDraft(round1(value));
    }
  };

  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-neutral-400">{label}</span>
      <input
        type="number"
        step={1}
        value={draft}
        onFocus={() => setEditing(true)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 tabular-nums"
      />
    </label>
  );
}

/** Округление до 0.1 мм в строку (для поля ввода). */
function round1(v: number): string {
  return String(Math.round(v * 10) / 10);
}

/** Загрузить фото (URL) → data URL + натуральные размеры. */
async function loadPhoto(
  src: string,
): Promise<{ dataUrl: string; w: number; h: number }> {
  const blob = await fetch(src).then((r) => r.blob());
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
  const dims = await new Promise<{ w: number; h: number }>((res, rej) => {
    const img = new window.Image();
    img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => rej(new Error("Не удалось загрузить фото"));
    img.src = dataUrl;
  });
  return { dataUrl, ...dims };
}

/** Размер SVG в мм по viewBox (для сцены PDF). */
function svgSizeMm(markup: string): { w: number; h: number } {
  const vb = markup.match(
    /viewBox\s*=\s*["']\s*([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)/i,
  );
  if (vb) return { w: parseFloat(vb[3]), h: parseFloat(vb[4]) };
  return { w: 600, h: 760 };
}

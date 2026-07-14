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
  printAreasForSize,
  flatForSize,
  viewHasZone,
} from "@/lib/geometry/view";
import { printMethodProfile } from "@/lib/catalog/printMethod";
import { buildSceneSvg } from "@/lib/export/buildSceneSvg";
import { buildPreviewSvg } from "@/lib/export/buildPreviewSvg";
import { exportScenesPdf } from "@/lib/export/exportPdf";
import { exportSvgAsPng } from "@/lib/export/exportPng";
import { resolveFlat } from "@/lib/export/resolveFlat";
import { preflight, type PreflightIssue } from "@/lib/export/preflight";
import type { Placement, View } from "@/types";
import { isAccessoryType } from "@/types";
import {
  GradingReviewModal,
  PreflightModal,
} from "@/components/editor/panelModals";
import { LayerRow } from "@/components/editor/LayerRow";
import { PlacementInspector } from "@/components/editor/PlacementInspector";
import { X, Cloud, HardDrive, Upload } from "lucide-react";

/** Пауза тишины перед автосохранением открытого проекта (мс). */
const AUTOSAVE_MS = 3000;

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
  const duplicateToAllZones = useProjectStore((s) => s.duplicateToAllZones);
  const reorderPlacement = useProjectStore((s) => s.reorderPlacement);
  const copyPlacementToView = useProjectStore((s) => s.copyPlacementToView);
  const mirrorPlacement = useProjectStore((s) => s.mirrorPlacement);
  const garmentColor = useProjectStore((s) => s.garmentColor);
  const setGarmentColor = useProjectStore((s) => s.setGarmentColor);

  // Сохранение проектов (Supabase или localStorage). id/имя открытого проекта
  // живут в сторе — открытие по ссылке /editor?project=… и панель видят одно
  // и то же, «Сохранить» всегда перезаписывает именно открытый проект.
  const projectId = useProjectStore((s) => s.projectId);
  const projectName = useProjectStore((s) => s.projectName);
  const setProjectRef = useProjectStore((s) => s.setProjectRef);
  const markSaved = useProjectStore((s) => s.markSaved);
  const dirty = useProjectStore((s) => s.dirty);
  const [projects, setProjects] = useState<ProjectSnapshot[]>([]);
  const [pmsg, setPmsg] = useState<string | null>(null);
  const refreshProjects = useCallback(() => {
    listProjects()
      .then(setProjects)
      .catch((e) => setPmsg(String(e)));
  }, []);
  useEffect(() => refreshProjects(), [refreshProjects]);

  const newProjectId = () =>
    globalThis.crypto?.randomUUID?.() ?? String(Date.now());
  const defaultProjectName = () =>
    projectName.trim() || `${sku?.name ?? "Проект"} ${orderRef}`.trim();

  // useCallback — стабильная ссылка для эффекта автосохранения (экшены
  // zustand и refreshProjects не меняются между рендерами).
  const persist = useCallback(
    async (id: string, name: string, okMsg?: string) => {
      try {
        await saveProject(snapshot(id, name));
        setProjectRef(id, name);
        markSaved();
        setPmsg(
          okMsg ?? (isCloud() ? "Сохранено в облако" : "Сохранено локально"),
        );
        refreshProjects();
      } catch (e) {
        setPmsg(`Ошибка сохранения: ${e}`);
      }
    },
    [snapshot, setProjectRef, markSaved, refreshProjects],
  );
  const onSaveProject = () =>
    void persist(projectId ?? newProjectId(), defaultProjectName());
  // Форк открытого проекта: новый id + «(копия)», исходный не трогаем.
  const onSaveProjectCopy = () =>
    void persist(newProjectId(), `${defaultProjectName()} (копия)`, "Сохранена копия");
  const onOpenProject = async (id: string) => {
    // Restore перетирает текущую раскладку — при несохранённых правках
    // спрашиваем (тот же гвард, что при смене SKU на витрине).
    const st = useProjectStore.getState();
    if (
      st.dirty &&
      st.placements.length > 0 &&
      !window.confirm(
        "Текущая раскладка не сохранена — открыть проект и потерять правки?",
      )
    )
      return;
    const s = await loadProject(id);
    if (s) {
      restore(s); // restore сам выставляет projectId/projectName в сторе
      setPmsg(`Открыт «${s.name}»`);
    }
  };
  const onDeleteProject = async (id: string) => {
    const name = projects.find((p) => p.id === id)?.name;
    if (!window.confirm(`Удалить проект «${name || "без названия"}»? Действие необратимо.`))
      return;
    await deleteProject(id);
    if (projectId === id) setProjectRef(null, projectName);
    refreshProjects();
  };

  // Автосохранение открытого проекта: через AUTOSAVE_MS тишины после правки
  // молча пересохраняем. Новые (ещё не сохранённые) раскладки не автосейвим —
  // черновики не должны плодиться без явного «Сохранить». Каждая правка
  // меняет deps (ссылки placements/цвет/мета) и перезаводит таймер.
  useEffect(() => {
    if (!projectId || !dirty) return;
    const t = setTimeout(() => {
      const st = useProjectStore.getState();
      if (!st.projectId || !st.dirty) return;
      const name =
        st.projectName.trim() ||
        `${st.currentSku()?.name ?? "Проект"} ${st.orderRef}`.trim();
      void persist(st.projectId, name, "Автосохранено");
    }, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [
    dirty,
    projectId,
    placements,
    assets,
    client,
    orderRef,
    status,
    garmentColor,
    size,
    persist,
  ]);

  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // Pre-export чеклист (S1.4): список проблем перед сборкой PDF.
  const [preflightIssues, setPreflightIssues] = useState<
    PreflightIssue[] | null
  >(null);
  // Действие экспорта, ожидающее подтверждения чеклиста (B2).
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  // Проверка ростовки (P1 #12): свод по всем размерам.
  const [showReview, setShowReview] = useState(false);

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
      const s = view.scale_mm_per_unit ?? 1;
      const flat = await resolveFlat(flatForSize(view, size ?? undefined), s);
      const vp = placements.filter((p) => viewHasZone(view, p.print_area_id));
      // Превью всегда на том же флэте, что и карточка каталога (с цветом ткани).
      const svg = buildPreviewSvg({
        view,
        flatSvgMarkup: flat.markup,
        flatRasterUrl: flat.rasterUrl,
        flatMm: flat.flatMm,
        scaleMmPerUnit: s,
        garmentColor,
        size: size ?? undefined,
        placements: vp,
        assets,
      });
      await exportSvgAsPng(svg, `${sku.id}-${view.kind}-preview.png`, 3);
      setMsg("PNG-превью готов");
    } catch (e) {
      setMsg(`Ошибка превью: ${e}`);
    } finally {
      setBusy(false);
    }
  };

  // Общий гейт: прогон preflight перед любым экспортом; при проблемах — модалка,
  // действие запускается по подтверждению.
  const gateExport = (action: () => void) => {
    if (!sku) return;
    const issues = preflight({
      views: sku.views,
      placements,
      assets,
      size: size ?? undefined,
    });
    if (issues.length > 0) {
      setPendingAction(() => action);
      setPreflightIssues(issues);
      return;
    }
    action();
  };

  const onExport = () => gateExport(() => void runExport());

  const runExport = async () => {
    if (!sku) return;
    setPreflightIssues(null);
    setBusy(true);
    setMsg(null);
    try {
      const viewsWithPlacements = sku.views.filter((v) =>
        placements.some((p) => viewHasZone(v, p.print_area_id)),
      );
      const target = viewsWithPlacements.length ? viewsWithPlacements : [];
      if (!target.length) {
        setMsg("Нет нанесений для экспорта");
        return;
      }
      const scenes: string[] = [];
      for (const v of target) {
        // Габариты в мм считает резолвер (viewBox × scale или растр × scale).
        const s = v.scale_mm_per_unit ?? 1;
        const flat = await resolveFlat(flatForSize(v, size ?? undefined), s);
        const vp = placements.filter((p) => viewHasZone(v, p.print_area_id));
        scenes.push(
          buildSceneSvg({
            sku,
            view: v,
            flatSvgMarkup: flat.markup,
            flatRaster: flat.rasterUrl ? { dataUrl: flat.rasterUrl } : undefined,
            flatMm: flat.flatMm,
            scaleMmPerUnit: s,
            garmentColor,
            placements: vp,
            assets,
            meta: {
              client,
              orderRef,
              size: size ?? sku.base_size,
              date: new Date().toLocaleDateString("ru-RU"),
              status,
            },
          }),
        );
      }
      await exportScenesPdf(scenes, `${sku.id}-${orderRef || "draft"}.pdf`);
      setMsg("Тех-рисунок (PDF) готов");
    } catch (e) {
      setMsg(`Ошибка экспорта: ${e}`);
    } finally {
      setBusy(false);
    }
  };

  if (!sku || !view) return null;

  // Нанесения текущего вида (порядок массива = z-order).
  const viewLayers = placements.filter((p) =>
    viewHasZone(view, p.print_area_id),
  );

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-4 text-sm">
      {/* Проект: сохранение + метаданные заказа + список сохранённых —
          единый блок в начале панели (заполняется до работы с макетом). */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold text-ink">
            Проект
            {dirty && (
              <span className="ml-1.5 align-middle text-[10px] font-normal text-amber-600">
                ● не сохранено
              </span>
            )}
          </h3>
          <span className="flex items-center gap-1 text-[10px] text-gray-400">
            {isCloud() ? <Cloud size={12} strokeWidth={1.75} /> : <HardDrive size={12} strokeWidth={1.75} />}
            {isCloud() ? "облако" : "локально"}
          </span>
        </div>
        <div className="mb-2 flex gap-2">
          <input
            value={projectName}
            onChange={(e) => setProjectRef(projectId, e.target.value)}
            placeholder="Название проекта"
            className="min-w-0 flex-1 rounded border border-line bg-white px-2 py-1.5 text-gray-900"
          />
          <button
            onClick={onSaveProject}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            Сохранить
          </button>
          {projectId && (
            <button
              onClick={onSaveProjectCopy}
              title="Сохранить как новый проект (исходный не изменится)"
              className="rounded bg-raised px-2.5 py-1.5 text-xs text-ink hover:bg-gray-200"
            >
              Как копию
            </button>
          )}
        </div>
        <label className="mb-1 block text-xs text-gray-500">Клиент</label>
        <input
          value={client}
          onChange={(e) => setMeta({ client: e.target.value })}
          className="mb-2 w-full rounded border border-line bg-white px-2 py-1.5 text-gray-900"
        />
        <label className="mb-1 block text-xs text-gray-500">Заказ №</label>
        <input
          value={orderRef}
          onChange={(e) => setMeta({ orderRef: e.target.value })}
          className="mb-2 w-full rounded border border-line bg-white px-2 py-1.5 text-gray-900"
        />
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Статус:</span>
          <button
            onClick={() =>
              setStatus(status === "draft" ? "approved" : "draft")
            }
            className={`rounded px-2.5 py-1 text-xs ${
              status === "approved"
                ? "bg-green-600 text-white"
                : "bg-raised text-ink"
            }`}
          >
            {status === "approved" ? "Согласовано" : "Черновик"}
          </button>
        </div>
        {projects.length > 0 && (
          <div className="mt-3 flex max-h-40 flex-col gap-1 overflow-y-auto">
            {projects.map((p) => (
              <div
                key={p.id}
                className={`flex items-center justify-between rounded px-2 py-1 text-xs ${
                  p.id === projectId ? "bg-raised" : "hover:bg-line-soft"
                }`}
              >
                <button
                  onClick={() => onOpenProject(p.id)}
                  className="min-w-0 flex-1 text-left"
                  title={p.name}
                >
                  <span className="block truncate text-ink">
                    {p.name || "(без названия)"}
                  </span>
                  <span className="block truncate text-[10px] text-gray-400">
                    {[
                      p.client,
                      new Date(p.savedAt).toLocaleString("ru-RU", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      }),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
                <button
                  onClick={() => onDeleteProject(p.id)}
                  className="ml-2 shrink-0 text-gray-400 hover:text-red-500"
                >
                  <X size={14} strokeWidth={1.75} />
                </button>
              </div>
            ))}
          </div>
        )}
        {pmsg && <p className="mt-1 text-[11px] text-gray-400">{pmsg}</p>}
      </section>

      <section>
        <h3 className="mb-2 font-semibold text-ink">Макет</h3>
        <input
          ref={fileRef}
          type="file"
          accept=".svg,.png,.jpg,.jpeg,.pdf,.ai,image/svg+xml,image/png,image/jpeg,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = "";
          }}
        />
        {areas.length > 1 && (
          <div className="mb-2">
            <label className="mb-1 block text-xs text-gray-500">Зона</label>
            <div className="flex flex-wrap gap-1.5">
              {areas.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setTargetAreaId(a.id)}
                  title={
                    a.methods?.length
                      ? `Методы: ${a.methods
                          .map((m) => printMethodProfile(m).label)
                          .join(", ")}`
                      : undefined
                  }
                  className={`rounded px-2.5 py-1 text-xs ${
                    a.id === activeAreaId
                      ? "bg-blue-600 text-white"
                      : "bg-raised text-gray-700 hover:bg-line-soft"
                  }`}
                >
                  {a.name}
                  {/* Бейдж допустимых методов зоны (если ограничены). */}
                  {!!a.methods?.length && (
                    <span
                      className={`ml-1 text-[9px] ${
                        a.id === activeAreaId ? "text-blue-200" : "text-gray-400"
                      }`}
                    >
                      {a.methods
                        .map((m) => printMethodProfile(m).short)
                        .join("+")}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
        <button
          onClick={() => fileRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 font-medium text-white hover:bg-blue-700"
        >
          <Upload size={16} strokeWidth={1.75} />
          Загрузить макет (SVG/PNG/JPG/PDF/AI)
        </button>
        <p className="mt-1 text-xs text-gray-400">
          Добавится в зону «
          {areas.find((a) => a.id === activeAreaId)?.name ??
            view.print_areas[0].name}
          » текущего вида.
        </p>
      </section>

      <section>
        <h3 className="mb-2 font-semibold text-ink">Размер (эталон)</h3>
        <div className="flex flex-wrap gap-1.5">
          {sku.sizes.map((sz) => (
            <button
              key={sz}
              onClick={() => selectSize(sz)}
              className={`rounded px-2.5 py-1 ${
                sz === size
                  ? "bg-blue-600 text-white"
                  : "bg-raised text-gray-700 hover:bg-line-soft"
              }`}
            >
              {sz}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-400">
          {isAccessoryType(sku.type)
            ? "Отступ от верха печатной зоны — константа на всех размерах."
            : "Отступ от горловины — константа на всех размерах (регрейдинг по per-size якорям)."}
        </p>
      </section>

      <section>
        <h3 className="mb-2 font-semibold text-ink">Цвет изделия</h3>
        <div className="flex items-center gap-1.5">
          {["", "#ffffff", "#1b1f24", "#3b4a6b", "#7a2230", "#2f5233", "#c9c4b8"].map(
            (c) => (
              <button
                key={c || "none"}
                onClick={() => setGarmentColor(c)}
                title={c || "без цвета (как на лекале)"}
                className={`h-6 w-6 rounded-full border ${
                  garmentColor === c ? "border-blue-500 ring-1 ring-blue-500" : "border-gray-300"
                } ${!c ? "bg-white text-[9px] text-gray-400" : ""}`}
                style={c ? { background: c } : undefined}
              >
                {!c ? "—" : ""}
              </button>
            ),
          )}
          <input
            type="color"
            value={garmentColor || "#ffffff"}
            onChange={(e) => setGarmentColor(e.target.value)}
            title="Свой цвет"
            className="h-6 w-8 cursor-pointer rounded border border-gray-300 bg-transparent"
          />
        </div>
      </section>

      <section>
        <h3 className="mb-2 font-semibold text-ink">Слои (этот вид)</h3>
        <div className="flex flex-col gap-1.5">
          {viewLayers.length === 0 && (
            <p className="text-xs text-gray-400">Пока пусто.</p>
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
              // Повторный клик по выбранному слою снимает выбор (закрывает инспектор).
              onSelect={() => selectPlacement(p.id === selectedId ? null : p.id)}
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

      {selectedPlacement && (
        <PlacementInspector
          placement={selectedPlacement}
          view={findViewForPlacement(sku.views, selectedPlacement)}
          views={sku.views}
          accessory={isAccessoryType(sku.type)}
          garmentSize={size}
          asset={assets[selectedPlacement.asset_id]}
          onChange={(patch) => updatePlacement(selectedPlacement.id, patch)}
          onDuplicate={() => duplicatePlacement(selectedPlacement.id)}
          onDuplicateAll={() => duplicateToAllZones(selectedPlacement.id)}
          onCopyToView={(vid) => copyPlacementToView(selectedPlacement.id, vid)}
          onMirror={() => mirrorPlacement(selectedPlacement.id)}
          onClose={() => selectPlacement(null)}
        />
      )}


      <section className="mt-auto space-y-2">
        <button
          onClick={() => setShowReview(true)}
          disabled={viewLayers.length === 0}
          className="w-full rounded-lg bg-raised px-3 py-2 text-sm font-medium text-ink hover:bg-gray-200 disabled:opacity-50"
        >
          Проверка ростовки
        </button>
        <button
          onClick={onExportPng}
          disabled={busy}
          className="w-full rounded-lg bg-raised px-3 py-2 text-sm font-medium text-ink hover:bg-gray-200 disabled:opacity-50"
        >
          Превью для клиента (PNG)
        </button>
        <button
          onClick={onExport}
          disabled={busy}
          title="Размер изделия, отступ от шва горловины и размер макета — в мм, 1:1"
          className="w-full rounded-lg bg-emerald-600 px-3 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? "Сборка…" : "Тех-рисунок (PDF)"}
        </button>
        {msg && <p className="mt-2 text-xs text-gray-500">{msg}</p>}
      </section>

      {preflightIssues && (
        <PreflightModal
          issues={preflightIssues}
          onCancel={() => {
            setPreflightIssues(null);
            setPendingAction(null);
          }}
          onProceed={() => {
            const act = pendingAction;
            setPreflightIssues(null);
            setPendingAction(null);
            act?.();
          }}
          onSelect={(pid) => {
            selectPlacement(pid);
            setPreflightIssues(null);
            setPendingAction(null);
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

    </div>
  );
}

function findViewForPlacement(views: View[], p: Placement): View | undefined {
  return views.find((v) => viewHasZone(v, p.print_area_id));
}

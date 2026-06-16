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
import { loadAsset } from "@/lib/catalog/loadAsset";
import {
  viewZone,
  placementInfo,
  printAreasForSize,
  presetPosition,
  flatForSize,
  type PositionPreset,
} from "@/lib/geometry/view";
import { printQuality } from "@/lib/catalog/dpi";
import { buildSceneSvg } from "@/lib/export/buildSceneSvg";
import { exportScenesPdf } from "@/lib/export/exportPdf";
import { resolveFlatMarkup } from "@/lib/export/flatMarkup";
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
  const addAsset = useProjectStore((s) => s.addAsset);
  const addPlacement = useProjectStore((s) => s.addPlacement);
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
    const loaded = await loadAsset(file);
    const assetId = addAsset({
      type: loaded.type,
      source_file: loaded.source_file,
      data_url: loaded.dataUrl,
      intrinsic_size_mm: loaded.intrinsic_size_mm,
      // Пиксельные размеры — для расчёта DPI печати.
      px_width: loaded.naturalWidth,
      px_height: loaded.naturalHeight,
      dpi: loaded.dpi,
      // Признак «размер оценочно» (для подсказки уточнить Ш×В).
      size_estimated: loaded.size_estimated,
    });
    const areaId = activeAreaId ?? view.print_areas[0].id;
    const { zone } = viewZone(view, size ?? undefined, areaId);
    // Вписываем макет в зону, сохраняя пропорции.
    const maxW = zone.zw * 0.7;
    const aspect =
      loaded.intrinsic_size_mm.height / loaded.intrinsic_size_mm.width || 1;
    const w = Math.min(loaded.intrinsic_size_mm.width, maxW);
    const h = w * aspect;
    addPlacement({
      print_area_id: areaId,
      asset_id: assetId,
      x_mm: zone.zx + (zone.zw - w) / 2,
      y_mm: zone.zy + (zone.zh - h) / 2,
      width_mm: w,
      height_mm: h,
      rotation_deg: 0,
    });
  };

  const onExport = async () => {
    if (!sku) return;
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

      {selectedPlacement && (
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

      <section className="mt-auto">
        <button
          onClick={onExport}
          disabled={busy}
          className="w-full rounded-lg bg-emerald-600 px-3 py-2.5 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? "Сборка PDF…" : "Экспорт PDF (1:1)"}
        </button>
        {msg && <p className="mt-2 text-xs text-neutral-400">{msg}</p>}
      </section>
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
  const { quality, dpi } = printQuality(asset, p.width_mm);
  const dpiColor =
    quality === "low" ? "text-red-400" : quality === "mid" ? "text-amber-400" : "text-neutral-500";

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
          className="min-w-0 flex-1 bg-transparent text-sm text-neutral-200 outline-none focus:rounded focus:bg-neutral-950 focus:px-1"
        />
        <span className={`shrink-0 text-[10px] tabular-nums ${dpiColor}`}>
          {quality === "vector" ? "вектор" : dpi ? `${Math.round(dpi)}dpi` : ""}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-0.5 text-xs">
        <button onClick={(e) => { e.stopPropagation(); onUp(); }} title="Выше" className={icon}>▲</button>
        <button onClick={(e) => { e.stopPropagation(); onDown(); }} title="Ниже" className={icon}>▼</button>
        <button onClick={(e) => { e.stopPropagation(); onToggleHidden(); }} title="Скрыть" className={icon}>{p.hidden ? "🙈" : "👁"}</button>
        <button onClick={(e) => { e.stopPropagation(); onToggleLocked(); }} title="Блокировать" className={icon}>{p.locked ? "🔒" : "🔓"}</button>
        <button onClick={(e) => { e.stopPropagation(); onDup(); }} title="Дублировать" className={icon}>⎘</button>
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} title="Удалить" className={`${icon} hover:text-red-400`}>✕</button>
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
  const presets: { key: PositionPreset; label: string }[] = [
    { key: "center-x", label: "Центр X" },
    { key: "center-zone", label: "Центр зоны" },
    { key: "top", label: "Вверх" },
    { key: "bottom", label: "Вниз" },
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

      {asset?.size_estimated && (
        <p className="mt-2 rounded bg-amber-950/60 px-2 py-1 text-xs text-amber-300">
          размер оценочно — уточните Ш×В
        </p>
      )}
      <DpiBadge asset={asset} printWidthMm={p.width_mm} />
    </section>
  );
}

const tbtn = (active?: boolean) =>
  `rounded px-2 py-1 text-xs ${active ? "bg-blue-600 text-white" : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700"}`;

/** Индикатор качества печати (DPI) на текущем размере макета. */
function DpiBadge({
  asset,
  printWidthMm,
}: {
  asset: Asset | undefined;
  printWidthMm: number;
}) {
  const { quality, dpi } = printQuality(asset, printWidthMm);
  if (quality === "unknown") return null;
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
      text: `${Math.round(dpi ?? 0)} DPI — приемлемо (уменьшите макет для 300+)`,
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

/** Размер SVG в мм по viewBox (для сцены PDF). */
function svgSizeMm(markup: string): { w: number; h: number } {
  const vb = markup.match(
    /viewBox\s*=\s*["']\s*([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)/i,
  );
  if (vb) return { w: parseFloat(vb[3]), h: parseFloat(vb[4]) };
  return { w: 600, h: 760 };
}

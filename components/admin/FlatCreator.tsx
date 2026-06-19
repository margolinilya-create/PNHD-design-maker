"use client";

import { useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { loadAsset } from "@/lib/catalog/loadAsset";
import {
  buildSkuFromDraft,
  validateDraft,
  type FlatDraft,
} from "@/lib/admin/flatDraft";
import { saveModel } from "@/lib/persistence/models";
import { parseDxf, processPiece, type PieceRef } from "@/lib/import/dxf";
import { buildSkuFromDxf } from "@/lib/import/dxfSku";
import { svgToDataUrl } from "@/lib/export/flatMarkup";
import { ChevronLeft, FileUp, Upload, TriangleAlert, ArrowRight } from "lucide-react";
import type { GarmentType, ViewKind, BaseSize, SKU } from "@/types";

const FlatEditorCanvas = dynamic(
  () => import("@/components/admin/FlatEditorCanvas").then((m) => m.FlatEditorCanvas),
  { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-gray-400">Загрузка холста…</div> },
);

function defaultDraft(dataUrl: string, wMm: number, hMm: number): FlatDraft {
  const cx = Math.round(wMm / 2);
  return {
    skuId: "new-model",
    skuName: "Новая модель",
    type: "tshirt",
    baseSize: "M",
    viewKind: "front",
    flatDataUrl: dataUrl,
    scaleMmPerUnit: 1,
    neckline: { x: cx, y: Math.round(hMm * 0.12) },
    centerAxisX: cx,
    sleeveBottomY: Math.round(hMm * 0.92),
    sleeveCenterX: cx,
    zone: {
      id: "chest",
      name: "Грудь",
      x: Math.round(wMm * 0.25),
      y: Math.round(hMm * 0.2),
      w: Math.round(wMm * 0.5),
      h: Math.round(hMm * 0.5),
      safe_inset_mm: 15,
    },
  };
}

function draftFromPiece(ref: PieceRef, r: ReturnType<typeof processPiece>): FlatDraft {
  const dataUrl = svgToDataUrl(r.svg);
  const kind: ViewKind = r.kind === "label" ? "front" : r.kind;
  const sizeTok = ref.size.split("-")[0];
  const base: BaseSize = sizeTok.toUpperCase() === "L" ? "L" : "M";
  const d = defaultDraft(dataUrl, r.wMm, r.hMm);
  return {
    ...d,
    skuId: `freefit-${kind}-${sizeTok}`.toLowerCase(),
    skuName: `${ref.piece} (${ref.size})`,
    baseSize: base,
    viewKind: kind,
    scaleMmPerUnit: 1,
    neckline: r.anchors.neckline_point ?? { x: r.cx, y: r.necklineY ?? 0 },
    centerAxisX: r.anchors.center_axis_x ?? r.cx,
    sleeveBottomY: r.anchors.sleeve_bottom_y ?? r.hMm,
    sleeveCenterX: r.anchors.sleeve_center_x ?? r.cx,
  };
}

export function FlatCreator({
  onBack,
  onContinue,
}: {
  onBack: () => void;
  /** Передать собранный SKU в полный редактор (мультивид/per-size/этикетка). */
  onContinue?: (sku: SKU) => void;
}) {
  const [draft, setDraft] = useState<FlatDraft | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dxfRef = useRef<HTMLInputElement>(null);
  const [dxf, setDxf] = useState<ReturnType<typeof parseDxf> | null>(null);
  const [pieceSel, setPieceSel] = useState("");
  const [sizeSel, setSizeSel] = useState("");

  const patch = (p: Partial<FlatDraft>) =>
    setDraft((d) => (d ? { ...d, ...p } : d));

  const onUpload = async (file: File) => {
    const loaded = await loadAsset(file);
    setDraft(defaultDraft(loaded.dataUrl, loaded.intrinsic_size_mm.width, loaded.intrinsic_size_mm.height));
    setSaved(null);
  };

  const onDxf = async (file: File) => {
    const parsed = parseDxf(await file.text());
    setDxf(parsed);
    setPieceSel(parsed.pieces[0]?.piece ?? "");
    setSizeSel(parsed.pieces[0]?.size ?? "");
  };

  const dxfPieces = useMemo(
    () => Array.from(new Set((dxf?.pieces ?? []).map((p) => p.piece))),
    [dxf],
  );
  const dxfSizes = useMemo(
    () => Array.from(new Set((dxf?.pieces ?? []).map((p) => p.size))),
    [dxf],
  );

  const createFromDxf = () => {
    if (!dxf) return;
    const ref = dxf.pieces.find((p) => p.piece === pieceSel && p.size === sizeSel);
    if (!ref) return;
    setDraft(draftFromPiece(ref, processPiece(dxf.blocks, ref)));
    setSaved(null);
  };

  const createFullSku = async () => {
    if (!dxf) return;
    const id = `dxf-${Date.now().toString(36)}`;
    const sku = buildSkuFromDxf(dxf, { skuId: id, skuName: "Модель из DXF" });
    // Открыть в полном редакторе для выверки зон/якорей; если редактор недоступен
    // — сохранить сразу в каталог.
    if (onContinue) {
      onContinue(sku);
      return;
    }
    await saveModel(sku);
    setSaved(sku.id);
  };

  // Одиночный флэт → продолжить в полном редакторе (добавить виды/размеры/зоны).
  const continueFromDraft = () => {
    if (!draft || errors.length || !onContinue) return;
    onContinue(buildSkuFromDraft(draft));
  };

  const json = useMemo(
    () => (draft ? JSON.stringify(buildSkuFromDraft(draft), null, 2) : ""),
    [draft],
  );
  const errors = useMemo(() => (draft ? validateDraft(draft) : []), [draft]);

  const download = () => {
    if (!draft) return;
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${draft.skuId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const addToCatalog = async () => {
    if (!draft || errors.length) return;
    await saveModel(buildSkuFromDraft(draft));
    setSaved(draft.skuId);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-4 border-b border-line px-4 py-2.5">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-ink">
          <ChevronLeft size={16} strokeWidth={1.75} /> К списку
        </button>
        <span className="text-sm font-semibold">Создание из флэта / DXF</span>
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
        <input
          ref={dxfRef}
          type="file"
          accept=".dxf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onDxf(f);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => dxfRef.current?.click()}
          className="ml-auto inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink hover:border-blue-500 hover:bg-line-soft"
        >
          <FileUp size={14} strokeWidth={1.75} /> Импорт DXF
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Upload size={14} strokeWidth={1.75} /> Загрузить флэт (SVG/PNG)
        </button>
      </header>

      {dxf && (
        <div className="flex flex-wrap items-end gap-2 border-b border-line bg-raised px-4 py-2 text-sm">
          <span className="text-xs text-gray-500">DXF: {dxf.pieces.length} деталей</span>
          <label className="flex flex-col gap-0.5">
            <span className="text-xs text-gray-400">Деталь</span>
            <select value={pieceSel} onChange={(e) => setPieceSel(e.target.value)} className={inp}>
              {dxfPieces.map((p) => (
                <option key={p} value={p}>{p.replace(/^.*Futbolka_/, "")}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-xs text-gray-400">Размер</span>
            <select value={sizeSel} onChange={(e) => setSizeSel(e.target.value)} className={inp}>
              {dxfSizes.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
          </label>
          <button onClick={createFromDxf} className="rounded-lg bg-raised px-3 py-1.5 text-sm font-medium text-ink hover:bg-gray-200">
            Черновик из детали
          </button>
          <button onClick={createFullSku} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700" title="Все виды + ростовки → открыть в редакторе для выверки зон">
            Собрать SKU <ArrowRight size={14} strokeWidth={1.75} /> редактор
          </button>
          {saved && <span className="text-xs text-emerald-600">«{saved}» в каталоге</span>}
        </div>
      )}

      {!draft ? (
        <div className="flex flex-1 items-center justify-center text-gray-400">
          Загрузите векторный/растровый флэт изделия, чтобы начать разметку.
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <main className="relative min-w-0 flex-1 bg-shell">
            <FlatEditorCanvas draft={draft} onChange={patch} />
          </main>
          <aside className="w-80 shrink-0 overflow-y-auto border-l border-line bg-white p-4 text-sm">
            <Section title="Модель">
              <Field label="ID (латиницей)">
                <input value={draft.skuId} onChange={(e) => patch({ skuId: e.target.value })} className={inp} />
              </Field>
              <Field label="Название">
                <input value={draft.skuName} onChange={(e) => patch({ skuName: e.target.value })} className={inp} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Тип">
                  <select value={draft.type} onChange={(e) => patch({ type: e.target.value as GarmentType })} className={inp}>
                    <option value="tshirt">tshirt</option>
                    <option value="sweatshirt">sweatshirt</option>
                    <option value="hoodie">hoodie</option>
                    <option value="shopper">shopper</option>
                  </select>
                </Field>
                <Field label="Базовый размер">
                  <select value={draft.baseSize} onChange={(e) => patch({ baseSize: e.target.value as BaseSize })} className={inp}>
                    <option value="M">M</option>
                    <option value="L">L</option>
                  </select>
                </Field>
              </div>
              <Field label="Вид">
                <select value={draft.viewKind} onChange={(e) => patch({ viewKind: e.target.value as ViewKind })} className={inp}>
                  <option value="front">перёд</option>
                  <option value="back">спина</option>
                  <option value="sleeve_left">рукав (л)</option>
                  <option value="sleeve_right">рукав (п)</option>
                  <option value="label_neck_inner">этикетка (внутр.)</option>
                  <option value="label_neck_outer">этикетка (внеш.)</option>
                </select>
              </Field>
            </Section>

            <Section title="Зона печати">
              <Field label="Название зоны">
                <input value={draft.zone.name} onChange={(e) => patch({ zone: { ...draft.zone, name: e.target.value } })} className={inp} />
              </Field>
              <Field label="safe-inset, мм">
                <input type="number" value={draft.zone.safe_inset_mm} onChange={(e) => patch({ zone: { ...draft.zone, safe_inset_mm: Number(e.target.value) } })} className={inp} />
              </Field>
              <p className="text-xs text-gray-400">Двигай/растягивай синий прямоугольник на холсте. Якоря — перетаскивай ручки.</p>
            </Section>

            {errors.length > 0 && (
              <div className="mb-3 rounded bg-red-50 p-2 text-xs text-red-700">
                {errors.map((e, i) => (<div key={i} className="flex items-center gap-1"><TriangleAlert size={13} strokeWidth={1.75} /> {e}</div>))}
              </div>
            )}

            <Section title="Экспорт">
              <div className="mb-2 flex gap-2">
                <button onClick={download} className="flex-1 rounded bg-raised px-2 py-1.5 text-xs hover:bg-gray-200">Скачать JSON</button>
                <button onClick={() => navigator.clipboard?.writeText(json)} className="flex-1 rounded bg-raised px-2 py-1.5 text-xs hover:bg-gray-200">Копировать</button>
              </div>
              {onContinue && (
                <button
                  onClick={continueFromDraft}
                  disabled={errors.length > 0}
                  title="Открыть в полном редакторе: добавить спину/рукав/этикетку, ростовку и per-size"
                  className="mb-2 inline-flex w-full items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Продолжить в редакторе <ArrowRight size={15} strokeWidth={1.75} />
                </button>
              )}
              <button onClick={addToCatalog} disabled={errors.length > 0} className="w-full rounded-lg bg-raised px-3 py-2 text-sm font-semibold text-ink hover:bg-gray-200 disabled:opacity-50">
                Добавить в каталог (только этот вид)
              </button>
              {saved && <p className="mt-2 text-xs text-emerald-600">«{saved}» в каталоге.</p>}
              <textarea readOnly value={json} className="mt-2 h-32 w-full rounded border border-line bg-shell p-2 font-mono text-[10px]" />
            </Section>
          </aside>
        </div>
      )}
    </div>
  );
}

const inp = "w-full rounded border border-line bg-shell px-2 py-1.5";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h3 className="mb-2 font-semibold text-ink">{title}</h3>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-gray-500">{label}</span>
      {children}
    </label>
  );
}

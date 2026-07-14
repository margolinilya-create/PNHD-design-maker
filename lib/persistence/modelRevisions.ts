// История версий карточки каталога: снимок SKU при каждом сохранении правки.
// Бэкенд: Supabase (таблица pinhead_model_revisions) или localStorage.
// Отдельно от pinhead_models — история переживает «Сбросить к заводской»
// (удаление override-строки), чтобы правки можно было восстановить.
import type { SKU } from "@/types";
import { getSupabase } from "./supabaseClient";

const REVISIONS_TABLE = "pinhead_model_revisions";
const LS_KEY = "pinhead.modelRevisions";
/** Максимум версий на карточку. */
export const REVISION_CAP = 20;

export interface ModelRevision {
  model_id: string;
  sku: SKU;
  saved_at: string;
}

/** Обрезать список до cap (список уже отсортирован свежие→старые). */
export function capRevisions<T>(list: T[], cap: number): T[] {
  return list.length > cap ? list.slice(0, cap) : list;
}

/** Совпадают ли два SKU по содержимому (skip-if-same при записи). */
export function sameSku(a: SKU, b: SKU): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ── localStorage ──
type LsMap = Record<string, ModelRevision[]>;
function lsAll(): LsMap {
  if (typeof window === "undefined") return {};
  try {
    const v = JSON.parse(window.localStorage.getItem(LS_KEY) || "{}");
    return v && typeof v === "object" ? (v as LsMap) : {};
  } catch {
    return {};
  }
}
function lsWrite(map: LsMap) {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(map));
  } catch {
    // Квота (флэты — data-URL в мегабайты): режем истории вдвое и пробуем раз.
    const trimmed: LsMap = {};
    for (const [id, revs] of Object.entries(map)) {
      trimmed[id] = revs.slice(0, Math.max(1, Math.floor(REVISION_CAP / 2)));
    }
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(trimmed));
    } catch {
      /* не помещается — историю молча пропускаем, каталог важнее */
    }
  }
}

export async function listRevisions(modelId: string): Promise<ModelRevision[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from(REVISIONS_TABLE)
      .select("model_id, sku, saved_at")
      .eq("model_id", modelId)
      .order("saved_at", { ascending: false })
      .limit(REVISION_CAP);
    if (error) throw error;
    return (data ?? []) as ModelRevision[];
  }
  return lsAll()[modelId] ?? [];
}

export async function pushRevision(modelId: string, sku: SKU): Promise<void> {
  // Не плодим одинаковые снимки подряд.
  const existing = await listRevisions(modelId).catch(() => []);
  if (existing[0] && sameSku(existing[0].sku, sku)) return;
  const rev: ModelRevision = {
    model_id: modelId,
    sku,
    saved_at: new Date().toISOString(),
  };
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from(REVISIONS_TABLE).insert(rev);
    if (error) throw error;
    // Обрезаем хвост за пределами cap.
    const { data } = await sb
      .from(REVISIONS_TABLE)
      .select("saved_at")
      .eq("model_id", modelId)
      .order("saved_at", { ascending: false })
      .limit(1000);
    const rows = data ?? [];
    if (rows.length > REVISION_CAP) {
      const cutoff = (rows[REVISION_CAP] as { saved_at: string }).saved_at;
      await sb
        .from(REVISIONS_TABLE)
        .delete()
        .eq("model_id", modelId)
        .lte("saved_at", cutoff);
    }
    return;
  }
  const map = lsAll();
  map[modelId] = capRevisions([rev, ...(map[modelId] ?? [])], REVISION_CAP);
  lsWrite(map);
}

export async function deleteRevisions(modelId: string): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb
      .from(REVISIONS_TABLE)
      .delete()
      .eq("model_id", modelId);
    if (error) throw error;
    return;
  }
  const map = lsAll();
  delete map[modelId];
  lsWrite(map);
}

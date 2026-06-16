// Пользовательские модели каталога (из DXF / «Редактора лекал»).
// Бэкенд: Supabase (если настроен env) или localStorage. API асинхронный.
import type { SKU } from "@/types";
import { getSupabase } from "./supabaseClient";

const MODELS_TABLE = "pinhead_models";
// Тот же ключ, что использовал flatDraft — преемственность локальных черновиков.
const LS_KEY = "pinhead.flatDrafts";

function lsAll(): SKU[] {
  if (typeof window === "undefined") return [];
  try {
    const v = JSON.parse(window.localStorage.getItem(LS_KEY) || "[]");
    return Array.isArray(v) ? (v as SKU[]) : [];
  } catch {
    return [];
  }
}
function lsWrite(list: SKU[]) {
  window.localStorage.setItem(LS_KEY, JSON.stringify(list));
}

export async function listModels(): Promise<SKU[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.from(MODELS_TABLE).select("sku");
    if (error) throw error;
    return (data ?? []).map((r: { sku: SKU }) => r.sku);
  }
  return lsAll();
}

export async function saveModel(sku: SKU): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb
      .from(MODELS_TABLE)
      .upsert({ id: sku.id, sku, saved_at: new Date().toISOString() });
    if (error) throw error;
    return;
  }
  const list = lsAll().filter((s) => s.id !== sku.id);
  list.push(sku);
  lsWrite(list);
}

export async function deleteModel(id: string): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from(MODELS_TABLE).delete().eq("id", id);
    if (error) throw error;
    return;
  }
  lsWrite(lsAll().filter((s) => s.id !== id));
}

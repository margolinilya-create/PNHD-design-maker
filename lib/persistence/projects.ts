// Сохранение/загрузка проектов. Бэкенд: Supabase (если настроен env),
// иначе localStorage. API асинхронный — единый для обоих бэкендов.
import type {
  Asset,
  Placement,
  ProjectComment,
  ProjectStatus,
} from "@/types";
import { getSupabase, PROJECTS_TABLE } from "./supabaseClient";

export interface ProjectSnapshot {
  id: string;
  name: string;
  skuId: string | null;
  size: string | null;
  client: string;
  orderRef: string;
  status: ProjectStatus;
  placements: Placement[];
  assets: Record<string, Asset>;
  garmentColor: string;
  comments?: ProjectComment[];
  savedAt: number;
}

const LS_KEY = "pinhead.projects";

export function isCloud(): boolean {
  return getSupabase() !== null;
}

// ── localStorage ──
function lsAll(): ProjectSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(LS_KEY) || "[]");
  } catch {
    return [];
  }
}
function lsWrite(list: ProjectSnapshot[]) {
  window.localStorage.setItem(LS_KEY, JSON.stringify(list));
}

// ── Публичный API ──
export async function listProjects(): Promise<ProjectSnapshot[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from(PROJECTS_TABLE)
      .select("*")
      .order("saved_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(rowToSnapshot);
  }
  return lsAll().sort((a, b) => b.savedAt - a.savedAt);
}

export async function saveProject(s: ProjectSnapshot): Promise<void> {
  const snap = { ...s, savedAt: Date.now() };
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from(PROJECTS_TABLE).upsert(snapshotToRow(snap));
    if (error) throw error;
    return;
  }
  const list = lsAll().filter((p) => p.id !== snap.id);
  list.push(snap);
  lsWrite(list);
}

export async function loadProject(id: string): Promise<ProjectSnapshot | null> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from(PROJECTS_TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToSnapshot(data) : null;
  }
  return lsAll().find((p) => p.id === id) ?? null;
}

export async function deleteProject(id: string): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from(PROJECTS_TABLE).delete().eq("id", id);
    if (error) throw error;
    return;
  }
  lsWrite(lsAll().filter((p) => p.id !== id));
}

// ── Маппинг строки БД ↔ снапшот ──
interface Row {
  id: string;
  name: string;
  sku_id: string | null;
  size: string | null;
  client: string;
  order_ref: string;
  status: ProjectStatus;
  data: {
    placements: Placement[];
    assets: Record<string, Asset>;
    garmentColor?: string;
    comments?: ProjectComment[];
  };
  saved_at: string;
}

function snapshotToRow(s: ProjectSnapshot): Row {
  return {
    id: s.id,
    name: s.name,
    sku_id: s.skuId,
    size: s.size,
    client: s.client,
    order_ref: s.orderRef,
    status: s.status,
    data: {
      placements: s.placements,
      assets: s.assets,
      garmentColor: s.garmentColor,
      comments: s.comments,
    },
    saved_at: new Date(s.savedAt).toISOString(),
  };
}

function rowToSnapshot(r: Row): ProjectSnapshot {
  return {
    id: r.id,
    name: r.name,
    skuId: r.sku_id,
    size: r.size,
    client: r.client,
    orderRef: r.order_ref,
    status: r.status,
    placements: r.data?.placements ?? [],
    assets: r.data?.assets ?? {},
    garmentColor: r.data?.garmentColor ?? "",
    comments: r.data?.comments ?? [],
    savedAt: new Date(r.saved_at).getTime(),
  };
}

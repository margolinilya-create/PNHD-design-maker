import { describe, it, expect, beforeEach } from "vitest";
import { useProjectStore } from "./projectStore";

const reset = () =>
  useProjectStore.setState({ placements: [], assets: {}, past: [], future: [], selectedPlacementId: null });

const sample = {
  print_area_id: "z", asset_id: "a",
  x_mm: 0, y_mm: 0, width_mm: 10, height_mm: 10, rotation_deg: 0,
};

describe("projectStore undo/redo", () => {
  beforeEach(reset);

  it("undo откатывает добавление, redo возвращает", () => {
    const s = useProjectStore.getState();
    s.addPlacement(sample);
    expect(useProjectStore.getState().placements).toHaveLength(1);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().placements).toHaveLength(0);
    useProjectStore.getState().redo();
    expect(useProjectStore.getState().placements).toHaveLength(1);
  });

  it("undo откатывает перемещение", () => {
    const s = useProjectStore.getState();
    const id = s.addPlacement(sample);
    useProjectStore.getState().updatePlacement(id, { x_mm: 99 });
    expect(useProjectStore.getState().placements[0].x_mm).toBe(99);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().placements[0].x_mm).toBe(0);
  });

  it("новое действие очищает future", () => {
    const s = useProjectStore.getState();
    s.addPlacement(sample);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().future).toHaveLength(1);
    useProjectStore.getState().addPlacement(sample);
    expect(useProjectStore.getState().future).toHaveLength(0);
  });

  it("duplicatePlacement создаёт копию со сдвигом и undo откатывает", () => {
    const s = useProjectStore.getState();
    const id = s.addPlacement(sample);
    useProjectStore.getState().duplicatePlacement(id);
    let st = useProjectStore.getState();
    expect(st.placements).toHaveLength(2);
    expect(st.placements[1].x_mm).toBe(sample.x_mm + 10);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().placements).toHaveLength(1);
  });

  it("snapshot/restore переносят раскладку и метаданные", () => {
    const s = useProjectStore.getState();
    s.addPlacement(sample);
    useProjectStore.getState().setMeta({ client: "ACME", orderRef: "42" });
    const snap = useProjectStore.getState().snapshot("p1", "Проект");
    expect(snap.placements).toHaveLength(1);
    expect(snap.client).toBe("ACME");
    reset();
    useProjectStore.getState().restore(snap);
    const st = useProjectStore.getState();
    expect(st.placements).toHaveLength(1);
    expect(st.orderRef).toBe("42");
  });

  it("duplicateToAllZones копирует во все зоны всех видов, кроме исходной", () => {
    useProjectStore.setState({
      catalog: {
        skus: [
          {
            id: "s", name: "S", type: "tshirt", base_size: "M", sizes: ["M"],
            views: [
              { id: "v1", kind: "front", flat_svg: "", scale_mm_per_unit: 1, anchors: {}, print_areas: [
                { id: "z1", name: "z1", polygon_mm: [[0, 0], [100, 0], [100, 100], [0, 100]], safe_inset_mm: 0 },
                { id: "z2", name: "z2", polygon_mm: [[0, 0], [80, 0], [80, 80], [0, 80]], safe_inset_mm: 0 },
              ] },
              { id: "v2", kind: "back", flat_svg: "", scale_mm_per_unit: 1, anchors: {}, print_areas: [
                { id: "z3", name: "z3", polygon_mm: [[0, 0], [60, 0], [60, 60], [0, 60]], safe_inset_mm: 0 },
              ] },
            ],
          },
        ],
      } as never,
      skuId: "s", viewId: "v1",
    });
    const id = useProjectStore.getState().addPlacement({ ...sample, print_area_id: "z1", width_mm: 20, height_mm: 20 });
    useProjectStore.getState().duplicateToAllZones(id);
    const ps = useProjectStore.getState().placements;
    // исходная z1 + копии в z2, z3
    expect(ps).toHaveLength(3);
    expect(ps.map((p) => p.print_area_id).sort()).toEqual(["z1", "z2", "z3"]);
    // центрирование в z2 (80×80, w20): x = (80−20)/2 = 30
    const inZ2 = ps.find((p) => p.print_area_id === "z2")!;
    expect(inZ2.x_mm).toBe(30);
  });

  it("duplicateToAllZones пропускает зоны, несовместимые с методом", () => {
    useProjectStore.setState({
      catalog: {
        skus: [
          {
            id: "s", name: "S", type: "tshirt", base_size: "M", sizes: ["M"],
            views: [
              { id: "v1", kind: "front", flat_svg: "", scale_mm_per_unit: 1, anchors: {}, print_areas: [
                { id: "z1", name: "z1", polygon_mm: [[0, 0], [100, 0], [100, 100], [0, 100]], safe_inset_mm: 0 },
                // Совместимая: шелкография разрешена.
                { id: "z2", name: "z2", polygon_mm: [[0, 0], [80, 0], [80, 80], [0, 80]], safe_inset_mm: 0, methods: ["screenprint", "dtf"] },
                // Несовместимая: только вышивка.
                { id: "z3", name: "z3", polygon_mm: [[0, 0], [60, 0], [60, 60], [0, 60]], safe_inset_mm: 0, methods: ["embroidery"] },
              ] },
            ],
          },
        ],
      } as never,
      skuId: "s", viewId: "v1",
    });
    const id = useProjectStore.getState().addPlacement({ ...sample, print_area_id: "z1", method: "screenprint" });
    useProjectStore.getState().duplicateToAllZones(id);
    const ps = useProjectStore.getState().placements;
    expect(ps.map((p) => p.print_area_id).sort()).toEqual(["z1", "z2"]);
  });

  it("copyPlacementToView копирует с print_area_id целевого вида", () => {
    useProjectStore.setState({
      catalog: {
        skus: [
          {
            id: "s", name: "S", type: "tshirt", base_size: "M", sizes: ["M"],
            views: [
              { id: "v1", kind: "front", flat_svg: "", scale_mm_per_unit: 1, anchors: {}, print_areas: [{ id: "z1", name: "z", polygon_mm: [[0, 0], [1, 0], [1, 1], [0, 1]], safe_inset_mm: 0 }] },
              { id: "v2", kind: "back", flat_svg: "", scale_mm_per_unit: 1, anchors: {}, print_areas: [{ id: "z2", name: "z", polygon_mm: [[0, 0], [1, 0], [1, 1], [0, 1]], safe_inset_mm: 0 }] },
            ],
          },
        ],
      } as never,
      skuId: "s", viewId: "v1",
    });
    const id = useProjectStore.getState().addPlacement({ ...sample, print_area_id: "z1" });
    useProjectStore.getState().copyPlacementToView(id, "v2");
    const ps = useProjectStore.getState().placements;
    expect(ps).toHaveLength(2);
    expect(ps[1].print_area_id).toBe("z2");
  });

  it("copyPlacementToView выбирает первую совместимую зону; нет совместимых — первую", () => {
    const mkView = (id: string, kind: string, areas: unknown[]) => ({
      id, kind, flat_svg: "", scale_mm_per_unit: 1, anchors: {}, print_areas: areas,
    });
    const rect = [[0, 0], [50, 0], [50, 50], [0, 50]];
    useProjectStore.setState({
      catalog: {
        skus: [
          {
            id: "s", name: "S", type: "tshirt", base_size: "M", sizes: ["M"],
            views: [
              mkView("v1", "front", [{ id: "z1", name: "z", polygon_mm: rect, safe_inset_mm: 0 }]),
              // Первая зона — только вышивка, вторая пускает DTF.
              mkView("v2", "back", [
                { id: "z2", name: "emb", polygon_mm: rect, safe_inset_mm: 0, methods: ["embroidery"] },
                { id: "z3", name: "dtf", polygon_mm: rect, safe_inset_mm: 0, methods: ["dtf"] },
              ]),
              // Ни одной совместимой — фоллбэк на первую.
              mkView("v3", "sleeve_left", [
                { id: "z4", name: "emb", polygon_mm: rect, safe_inset_mm: 0, methods: ["embroidery"] },
              ]),
            ],
          },
        ],
      } as never,
      skuId: "s", viewId: "v1",
    });
    const id = useProjectStore.getState().addPlacement({ ...sample, print_area_id: "z1", method: "dtf" });
    useProjectStore.getState().copyPlacementToView(id, "v2");
    expect(useProjectStore.getState().placements[1].print_area_id).toBe("z3");
    useProjectStore.getState().copyPlacementToView(id, "v3");
    expect(useProjectStore.getState().placements[2].print_area_id).toBe("z4");
  });
});

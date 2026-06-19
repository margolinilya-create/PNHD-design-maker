import { describe, it, expect, beforeEach } from "vitest";
import { useProjectStore } from "./projectStore";

const reset = () =>
  useProjectStore.setState({ placements: [], assets: {}, past: [], future: [], selectedPlacementId: null, comments: [], readOnly: false });

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

  it("комментарии согласования: добавление, удаление, roundtrip snapshot", () => {
    const s = useProjectStore.getState();
    s.addComment({ role: "client", text: "сместить выше" });
    s.addComment({ role: "shop", text: "ок, принято" });
    let st = useProjectStore.getState();
    expect(st.comments).toHaveLength(2);
    expect(st.comments[0].role).toBe("client");
    // snapshot переносит комментарии
    const snap = st.snapshot("p1", "Проект");
    expect(snap.comments).toHaveLength(2);
    // удаление
    st.removeComment(st.comments[0].id);
    expect(useProjectStore.getState().comments).toHaveLength(1);
    // restore возвращает комментарии из снапшота
    useProjectStore.getState().restore(snap);
    expect(useProjectStore.getState().comments).toHaveLength(2);
  });

  it("режим только просмотр переключается", () => {
    useProjectStore.getState().setReadOnly(true);
    expect(useProjectStore.getState().readOnly).toBe(true);
    useProjectStore.getState().setReadOnly(false);
    expect(useProjectStore.getState().readOnly).toBe(false);
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
});

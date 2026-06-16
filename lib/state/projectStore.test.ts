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

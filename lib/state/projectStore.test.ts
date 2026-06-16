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
});

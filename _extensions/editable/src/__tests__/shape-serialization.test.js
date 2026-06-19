import { describe, it, expect, vi } from "vitest";

// Mock document-touching dependencies before importing serialization.js
// (mirrors serialization.test.js).
vi.mock("../config.js", () => ({ CONFIG: { NEW_FENCE_LENGTH: 3 } }));
vi.mock("../colors.js", () => ({
  getBrandColorOutput: (color) => color,
  normalizeColor: (color) => color,
}));
vi.mock("../utils.js", () => ({
  round: (n) => Math.round(n * 10) / 10,
  getOriginalEditableElements: () => [],
  getOriginalEditableDivs: () => [],
}));
vi.mock("../editable-element.js", () => ({ editableRegistry: new Map() }));
vi.mock("../registries.js", () => ({
  NewElementRegistry: { newSlides: [], newDivs: [], newArrows: [], newShapes: [], countNewSlidesBefore: () => 0 },
}));
vi.mock("../quill.js", () => ({ quillInstances: new Map() }));

import { serializeShapeAttrs } from "../serialization.js";

describe("serializeShapeAttrs", () => {
  it("emits shape class, .absolute, and position attributes", () => {
    const out = serializeShapeAttrs({
      shapeType: "hexagon",
      left: 120,
      top: 80,
      width: 200,
      height: 200,
    });
    expect(out).toContain(".shape-hexagon");
    expect(out).toContain(".absolute");
    expect(out).toContain("left=120px");
    expect(out).toContain("top=80px");
    expect(out).toContain("width=200px");
    expect(out).toContain("height=200px");
  });

  it("includes fill and stroke as quoted attributes", () => {
    const out = serializeShapeAttrs({
      shapeType: "circle",
      left: 0, top: 0, width: 100, height: 100,
      fill: "#4DADAD",
      stroke: "#E24A68",
    });
    expect(out).toContain('fill="#4DADAD"');
    expect(out).toContain('stroke="#E24A68"');
  });

  it("emits the stroke-width modifier class", () => {
    const out = serializeShapeAttrs({
      shapeType: "circle",
      left: 0, top: 0, width: 100, height: 100,
      strokeWidth: "lg",
    });
    expect(out).toContain(".shape-stroke-lg");
  });

  it("includes direction for callouts and rotation as inline transform", () => {
    const out = serializeShapeAttrs({
      shapeType: "callout-round",
      left: 0, top: 0, width: 100, height: 100,
      direction: "45",
      rotation: 30,
    });
    expect(out).toContain('direction="45"');
    expect(out).toContain('style="transform: rotate(30deg);"');
  });

  it("omits optional attributes when absent", () => {
    const out = serializeShapeAttrs({
      shapeType: "square",
      left: 10, top: 10, width: 50, height: 50,
    });
    expect(out).not.toContain("fill=");
    expect(out).not.toContain("stroke=");
    expect(out).not.toContain("direction=");
    expect(out).not.toContain("style=");
  });
});

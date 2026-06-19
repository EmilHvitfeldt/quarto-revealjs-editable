import { describe, it, expect } from "vitest";
import {
  renderShapeSvg,
  shapeMarkup,
  parseDirection,
  isCallout,
  isKnownShape,
  SHAPES,
  CALLOUTS,
  SHAPE_TYPES,
} from "../shape-svg.js";

describe("static shape catalog", () => {
  it("wraps inner markup in a 100x100 shape-svg", () => {
    const svg = renderShapeSvg("hexagon");
    expect(svg).toContain('class="shape-svg"');
    expect(svg).toContain('viewBox="0 0 100 100"');
    expect(svg).toContain("</svg>");
    expect(svg).toContain("shape-path");
  });

  it("renders a circle from the static catalog", () => {
    expect(shapeMarkup("circle")).toBe(SHAPES.circle);
  });

  it("returns empty markup for unknown shapes", () => {
    expect(shapeMarkup("not-a-shape")).toBe("");
    expect(isKnownShape("not-a-shape")).toBe(false);
    expect(isKnownShape("hexagon")).toBe(true);
  });
});

describe("direction parsing", () => {
  it("defaults to 180 (down)", () => {
    expect(parseDirection(undefined)).toBe(180);
    expect(parseDirection(null)).toBe(180);
    expect(parseDirection("")).toBe(180);
  });

  it("resolves keywords and numbers", () => {
    expect(parseDirection("up")).toBe(0);
    expect(parseDirection("right")).toBe(90);
    expect(parseDirection("down")).toBe(180);
    expect(parseDirection("left")).toBe(270);
    expect(parseDirection("45")).toBe(45);
    expect(parseDirection(225)).toBe(225);
  });

  it("falls back to 180 for garbage", () => {
    expect(parseDirection("sideways")).toBe(180);
  });
});

describe("parametric callouts (matched against shapes.lua output)", () => {
  it("identifies callouts", () => {
    expect(isCallout("callout-round")).toBe(true);
    expect(isCallout("speech-bubble")).toBe(true);
    expect(isCallout("hexagon")).toBe(false);
  });

  it("points the round callout down by default", () => {
    // apex at bottom-center
    expect(shapeMarkup("callout-round")).toContain("L50.00,96.00 Z");
  });

  it("points direction=45 up and to the right", () => {
    expect(shapeMarkup("callout-round", "45")).toContain("L82.53,17.47 Z");
  });

  it("points direction=225 down and to the left", () => {
    expect(shapeMarkup("callout-round", "225")).toContain("L17.47,82.53 Z");
  });

  it("points the oval callout direction=300 up and to the left", () => {
    expect(shapeMarkup("callout-oval", "300")).toContain("L10.70,27.31 Z");
  });

  it("points a speech bubble up via keyword", () => {
    // spike apex on the top edge, center
    expect(shapeMarkup("speech-bubble", "up")).toContain("L50.00,10.00");
  });
});

describe("picker metadata", () => {
  it("only lists known shapes", () => {
    for (const t of SHAPE_TYPES) {
      expect(isKnownShape(t.name)).toBe(true);
    }
  });

  it("lists every shape in the catalog exactly once", () => {
    const catalog = new Set([...Object.keys(SHAPES), ...Object.keys(CALLOUTS)]);
    const listed = SHAPE_TYPES.map((t) => t.name);
    // No duplicates in the picker.
    expect(new Set(listed).size).toBe(listed.length);
    // Every catalog shape is exposed, and nothing unknown is listed.
    expect(new Set(listed)).toEqual(catalog);
  });

  it("marks callout types as direction-aware", () => {
    const speech = SHAPE_TYPES.find((t) => t.name === "speech-bubble");
    expect(speech.direction).toBe(true);
    const hex = SHAPE_TYPES.find((t) => t.name === "hexagon");
    expect(hex && hex.direction).toBeFalsy();
  });
});

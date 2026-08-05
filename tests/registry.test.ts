import { describe, expect, it } from "vitest";
import { TASK_ENDPOINTS, TASK_TYPE_VALUES, endpointFor } from "../src/registry.js";

describe("registry", () => {
  it("has 29 task types (15 core + 7 creative-lab products × 2 stages)", () => {
    expect(TASK_TYPE_VALUES).toHaveLength(29);
  });

  it("maps core endpoints correctly", () => {
    expect(endpointFor("text-to-3d")).toBe("/openapi/v2/text-to-3d");
    expect(endpointFor("image-to-3d")).toBe("/openapi/v1/image-to-3d");
    expect(endpointFor("animation")).toBe("/openapi/v1/animations");
    expect(endpointFor("rigging")).toBe("/openapi/v1/rigging");
    expect(endpointFor("multi-color-print")).toBe("/openapi/v1/print/multi-color");
    expect(endpointFor("analyze-printability")).toBe("/openapi/v1/print/analyze");
    expect(endpointFor("repair-printability")).toBe("/openapi/v1/print/repair");
  });

  it("maps creative-lab stage-qualified endpoints", () => {
    expect(endpointFor("keychain-prototype")).toBe("/openapi/creative-lab/keychain/v1/prototype");
    expect(endpointFor("lamp-build")).toBe("/openapi/creative-lab/lamp/v1/build");
    expect(endpointFor("keycap-build")).toBe("/openapi/creative-lab/keycap/v1/build");
  });

  it("every endpoint starts with /openapi/", () => {
    for (const path of Object.values(TASK_ENDPOINTS)) {
      expect(path).toMatch(/^\/openapi\//);
    }
  });

  it("throws on unknown task type", () => {
    expect(() => endpointFor("bogus" as never)).toThrow(/Unknown task_type/);
  });
});

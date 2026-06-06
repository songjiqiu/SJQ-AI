import { describe, expect, it } from "vitest";

import {
  createDeckFormDefaults,
  createDeckFormSchema
} from "@/lib/create-deck/schema";

const validForm = {
  ...createDeckFormDefaults,
  idea: "为新能源初创公司准备融资路演"
};

describe("createDeckFormSchema", () => {
  it("accepts the default selectable values with required text", () => {
    const parsed = createDeckFormSchema.parse(validForm);

    expect(parsed.pageCount).toBe(6);
    expect(parsed.deckType).toBe("business-report");
    expect(parsed.palette).toBe("star-map");
  });

  it("accepts expanded deck types", () => {
    const parsed = createDeckFormSchema.parse({
      ...validForm,
      deckType: "fundraising-pitch"
    });

    expect(parsed.deckType).toBe("fundraising-pitch");
  });

  it("accepts expanded palette presets", () => {
    const parsed = createDeckFormSchema.parse({
      ...validForm,
      palette: "bamboo-green"
    });

    expect(parsed.palette).toBe("bamboo-green");
  });

  it("rejects unknown deck types", () => {
    expect(
      createDeckFormSchema.safeParse({
        ...validForm,
        deckType: "unknown-type"
      }).success
    ).toBe(false);
  });

  it("rejects unknown palette presets", () => {
    expect(
      createDeckFormSchema.safeParse({
        ...validForm,
        palette: "unknown-palette"
      }).success
    ).toBe(false);
  });

  it("ignores legacy narrative style values from saved form data", () => {
    const parsed = createDeckFormSchema.parse({
      ...validForm,
      style: "product"
    });

    expect(parsed).not.toHaveProperty("style");
  });

  it("rejects missing or too short required text", () => {
    expect(
      createDeckFormSchema.safeParse({ ...validForm, idea: "短" }).success
    ).toBe(false);
  });

  it("limits page count to 6 through 40", () => {
    expect(
      createDeckFormSchema.safeParse({ ...validForm, pageCount: 5 }).success
    ).toBe(false);
    expect(
      createDeckFormSchema.safeParse({ ...validForm, pageCount: 6 }).success
    ).toBe(true);
    expect(
      createDeckFormSchema.safeParse({ ...validForm, pageCount: 40 }).success
    ).toBe(true);
    expect(
      createDeckFormSchema.safeParse({ ...validForm, pageCount: 41 }).success
    ).toBe(false);
  });
});

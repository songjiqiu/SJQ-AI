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
    expect(parsed.style).toBe("strategic");
    expect(parsed.palette).toBe("star-map");
  });

  it("accepts expanded deck types and narrative styles", () => {
    const parsed = createDeckFormSchema.parse({
      ...validForm,
      deckType: "fundraising-pitch",
      style: "data"
    });

    expect(parsed.deckType).toBe("fundraising-pitch");
    expect(parsed.style).toBe("data");
  });

  it("rejects unknown deck types and narrative styles", () => {
    expect(
      createDeckFormSchema.safeParse({
        ...validForm,
        deckType: "unknown-type"
      }).success
    ).toBe(false);
    expect(
      createDeckFormSchema.safeParse({
        ...validForm,
        style: "unknown-style"
      }).success
    ).toBe(false);
  });

  it("keeps legacy product style parseable for saved data", () => {
    const parsed = createDeckFormSchema.parse({
      ...validForm,
      style: "product"
    });

    expect(parsed.style).toBe("product");
  });

  it("rejects missing or too short required text", () => {
    expect(
      createDeckFormSchema.safeParse({ ...validForm, idea: "短" }).success
    ).toBe(false);
  });

  it("limits page count to 3 through 18", () => {
    expect(
      createDeckFormSchema.safeParse({ ...validForm, pageCount: 2 }).success
    ).toBe(false);
    expect(
      createDeckFormSchema.safeParse({ ...validForm, pageCount: 3 }).success
    ).toBe(true);
    expect(
      createDeckFormSchema.safeParse({ ...validForm, pageCount: 18 }).success
    ).toBe(true);
    expect(
      createDeckFormSchema.safeParse({ ...validForm, pageCount: 19 }).success
    ).toBe(false);
  });
});

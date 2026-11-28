import { describe, expect, it } from "vitest";
import { extractLastDigit, spreadOtpDigits } from "./OtpInput";

describe("OtpInput helpers", () => {
  it("extracts the last digit and ignores non-digits", () => {
    expect(extractLastDigit("7")).toBe("7");
    expect(extractLastDigit("19")).toBe("9");
    expect(extractLastDigit("a")).toBe("");
    expect(extractLastDigit("a4b")).toBe("4");
  });

  it("spreads a 6-digit paste across all 6 boxes", () => {
    expect(spreadOtpDigits("123456")).toEqual(["1", "2", "3", "4", "5", "6"]);
  });

  it("strips non-digits and truncates to 6 when pasting", () => {
    expect(spreadOtpDigits(" 12-34 5678 ")).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
    ]);
  });

  it("pads shorter digit pastes with empty strings", () => {
    expect(spreadOtpDigits("42")).toEqual(["4", "2", "", "", "", ""]);
  });

  it("returns null when pasted text has no digits", () => {
    expect(spreadOtpDigits("hello-world!")).toBeNull();
    expect(spreadOtpDigits("")).toBeNull();
  });
});

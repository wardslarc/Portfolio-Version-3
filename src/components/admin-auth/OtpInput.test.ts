import { describe, expect, it } from "vitest";
import { applyOtpInput, extractLastDigit, spreadOtpDigits } from "./OtpInput";

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

  it("spreads autofilled 6-digit input in box 1 across all six boxes", () => {
    const empty = ["", "", "", "", "", ""];
    expect(applyOtpInput(empty, 0, "123456")).toEqual({
      digits: ["1", "2", "3", "4", "5", "6"],
      nextFocus: 5,
    });
  });

  it("replaces a single digit in a filled box and moves focus right", () => {
    const filled = ["5", "2", "3", "4", "5", "6"];
    expect(applyOtpInput(filled, 0, "7")).toEqual({
      digits: ["7", "2", "3", "4", "5", "6"],
      nextFocus: 1,
    });
  });

  it("replaces the existing digit when typing into a filled box without selection", () => {
    const partial = ["1", "2", "5", "4", "", ""];
    expect(applyOtpInput(partial, 2, "57")).toEqual({
      digits: ["1", "2", "7", "4", "", ""],
      nextFocus: 3,
    });
    expect(applyOtpInput(partial, 2, "75")).toEqual({
      digits: ["1", "2", "7", "4", "", ""],
      nextFocus: 3,
    });
    expect(applyOtpInput(partial, 2, "55")).toEqual({
      digits: ["1", "2", "5", "4", "", ""],
      nextFocus: 3,
    });
  });

  it("spreads 2-digit input when the target box is empty", () => {
    const empty = ["", "", "", "", "", ""];
    expect(applyOtpInput(empty, 0, "12")).toEqual({
      digits: ["1", "2", "", "", "", ""],
      nextFocus: 2,
    });
  });
});

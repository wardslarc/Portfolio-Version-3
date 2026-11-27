import { describe, expect, it } from "vitest";
import { validate } from "./validate";

describe("contact form validate", () => {
  it("returns no errors for valid input", () => {
    expect(validate("Carls", "carls@example.com", "Building a new portfolio site.")).toEqual({});
  });

  it("requires a non-empty name", () => {
    expect(validate("   ", "carls@example.com", "Building a new portfolio site.")).toEqual({
      name: "Enter your name.",
    });
  });

  it("requires a valid email format", () => {
    expect(validate("Carls", "not-an-email", "Building a new portfolio site.")).toEqual({
      email: "Enter an email like name@company.com.",
    });
  });

  it("requires at least 10 characters in the message after trimming", () => {
    expect(validate("Carls", "carls@example.com", "  short  ")).toEqual({
      message: "Write at least a sentence so I know what you need.",
    });
  });

  it("returns all applicable errors at once", () => {
    expect(validate("", "bad", "hi")).toEqual({
      name: "Enter your name.",
      email: "Enter an email like name@company.com.",
      message: "Write at least a sentence so I know what you need.",
    });
  });
});

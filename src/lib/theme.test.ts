import { afterEach, describe, expect, it, vi } from "vitest";
import { THEME_STORAGE_KEY, applyStoredTheme, themeScript } from "./theme";

function createStubElement() {
  const attrs = new Map<string, string>();
  return {
    setAttribute(name: string, value: string) {
      attrs.set(name, value);
    },
    removeAttribute(name: string) {
      attrs.delete(name);
    },
    getAttribute(name: string) {
      return attrs.get(name) ?? null;
    },
    hasAttribute(name: string) {
      return attrs.has(name);
    },
  };
}

function runThemeScript(opts: {
  pathname: string;
  stored?: string | null;
  throwOnStorage?: boolean;
}) {
  const root = createStubElement();
  const getItem = vi.fn(() => {
    if (opts.throwOnStorage) throw new Error("SecurityError");
    return opts.stored ?? null;
  });
  const fn = new Function("document", "location", "localStorage", themeScript);
  fn(
    { documentElement: root },
    { pathname: opts.pathname },
    { getItem }
  );
  return { root, getItem };
}

describe("themeScript", () => {
  it("sets data-home on / and never reads storage", () => {
    const { root, getItem } = runThemeScript({ pathname: "/", stored: "dark" });
    expect(root.getAttribute("data-home")).toBe("");
    expect(root.hasAttribute("data-theme")).toBe(false);
    expect(getItem).not.toHaveBeenCalled();
  });

  it('sets data-theme="dark" on /blog when dark is stored', () => {
    const { root, getItem } = runThemeScript({ pathname: "/blog", stored: "dark" });
    expect(getItem).toHaveBeenCalledWith(THEME_STORAGE_KEY);
    expect(root.getAttribute("data-theme")).toBe("dark");
    expect(root.hasAttribute("data-home")).toBe(false);
  });

  it('sets data-theme="light" on /blog when light is stored', () => {
    const { root } = runThemeScript({ pathname: "/blog", stored: "light" });
    expect(root.getAttribute("data-theme")).toBe("light");
    expect(root.hasAttribute("data-home")).toBe(false);
  });

  it("sets no attribute on /blog when nothing is stored", () => {
    const { root } = runThemeScript({ pathname: "/blog", stored: null });
    expect(root.hasAttribute("data-theme")).toBe(false);
    expect(root.hasAttribute("data-home")).toBe(false);
  });

  it("ignores invalid stored values", () => {
    const { root } = runThemeScript({ pathname: "/blog", stored: "sepia" });
    expect(root.hasAttribute("data-theme")).toBe(false);
  });

  it("does not throw if localStorage throws", () => {
    expect(() =>
      runThemeScript({ pathname: "/blog", throwOnStorage: true })
    ).not.toThrow();
  });
});

describe("applyStoredTheme", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("clears existing data-theme and applies stored theme", () => {
    const root = createStubElement();
    root.setAttribute("data-theme", "light");
    vi.stubGlobal("document", { documentElement: root });
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => "dark"),
    });

    applyStoredTheme();
    expect(root.getAttribute("data-theme")).toBe("dark");
  });

  it("removes data-theme when nothing is stored or storage throws", () => {
    const root = createStubElement();
    root.setAttribute("data-theme", "dark");
    vi.stubGlobal("document", { documentElement: root });
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => {
        throw new Error("blocked");
      }),
    });

    applyStoredTheme();
    expect(root.hasAttribute("data-theme")).toBe(false);
  });
});

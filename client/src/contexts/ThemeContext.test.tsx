import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getInitialTheme, ThemeProvider, useTheme } from "./ThemeContext";

function mockMatchMedia(prefersDark: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: prefersDark,
      media: "",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

// ─── getInitialTheme ──────────────────────────────────────────────────────────

describe("getInitialTheme", () => {
  beforeEach(() => localStorage.clear());

  it('ストレージに何もない → "system"', () => {
    expect(getInitialTheme()).toBe("system");
  });

  it('"light" が保存済み → "light"', () => {
    localStorage.setItem("theme", "light");
    expect(getInitialTheme()).toBe("light");
  });

  it('"dark" が保存済み → "dark"', () => {
    localStorage.setItem("theme", "dark");
    expect(getInitialTheme()).toBe("dark");
  });

  it('"system" が保存済み → "system"', () => {
    localStorage.setItem("theme", "system");
    expect(getInitialTheme()).toBe("system");
  });

  it('無効な値 → 削除して "system" にフォールバック', () => {
    localStorage.setItem("theme", "invalid-value");
    expect(getInitialTheme()).toBe("system");
    expect(localStorage.getItem("theme")).toBeNull();
  });
});

// ─── useTheme (Provider 外) ───────────────────────────────────────────────────

describe("useTheme", () => {
  it("ThemeProvider 外で呼ぶと明示的エラーをスロー", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useTheme())).toThrow(
      "useTheme must be used within ThemeProvider"
    );
    spy.mockRestore();
  });
});

// ─── ThemeProvider ────────────────────────────────────────────────────────────

describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('デフォルトテーマは "system"', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe("system");
  });

  it('"dark" が保存済みの場合 .dark クラスが付与される', () => {
    localStorage.setItem("theme", "dark");
    renderHook(() => useTheme(), { wrapper });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it('"light" が保存済みの場合 .dark クラスが除去される', () => {
    document.documentElement.classList.add("dark");
    localStorage.setItem("theme", "light");
    renderHook(() => useTheme(), { wrapper });
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("システムがダーク設定の場合 .dark クラスが付与される", () => {
    mockMatchMedia(true);
    renderHook(() => useTheme(), { wrapper });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("システムがライト設定の場合 .dark クラスが付与されない", () => {
    mockMatchMedia(false);
    renderHook(() => useTheme(), { wrapper });
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("setTheme でテーマ状態と localStorage が更新される", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => result.current.setTheme("dark"));
    expect(result.current.theme).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("setTheme('light') で .dark クラスが除去される", () => {
    document.documentElement.classList.add("dark");
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => result.current.setTheme("light"));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("setTheme('dark') で .dark クラスが付与される", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => result.current.setTheme("dark"));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("system モードでは matchMedia の change リスナーが登録される", () => {
    const addListenerSpy = vi.fn();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        media: "",
        onchange: null,
        addEventListener: addListenerSpy,
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
    renderHook(() => useTheme(), { wrapper });
    expect(addListenerSpy).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("system 以外のモードでは matchMedia リスナーが登録されない", () => {
    localStorage.setItem("theme", "dark");
    const addListenerSpy = vi.fn();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        media: "",
        onchange: null,
        addEventListener: addListenerSpy,
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
    renderHook(() => useTheme(), { wrapper });
    expect(addListenerSpy).not.toHaveBeenCalled();
  });

  it("system モードで matchMedia のリスナーがアンマウント時に解除される", () => {
    const removeListenerSpy = vi.fn();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        media: "",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: removeListenerSpy,
        dispatchEvent: vi.fn(),
      }),
    });
    const { unmount } = renderHook(() => useTheme(), { wrapper });
    unmount();
    expect(removeListenerSpy).toHaveBeenCalledWith("change", expect.any(Function));
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../contexts/ThemeContext";
import ThemeToggle from "./ThemeToggle";

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      media: "",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
});

describe("ThemeToggle", () => {
  it("3つのラジオボタンが描画される", () => {
    renderToggle();
    expect(screen.getByRole("radio", { name: "ライト" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "システム" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "ダーク" })).toBeInTheDocument();
  });

  it("デフォルトでは「システム」が選択済み", () => {
    renderToggle();
    expect(screen.getByRole("radio", { name: "システム" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "ライト" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "ダーク" })).not.toBeChecked();
  });

  it("「ライト」をクリックすると light が選択される", async () => {
    const user = userEvent.setup();
    renderToggle();
    await user.click(screen.getByRole("radio", { name: "ライト" }));
    expect(screen.getByRole("radio", { name: "ライト" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "システム" })).not.toBeChecked();
  });

  it("「ライト」をクリックすると localStorage に保存される", async () => {
    const user = userEvent.setup();
    renderToggle();
    await user.click(screen.getByRole("radio", { name: "ライト" }));
    expect(localStorage.getItem("theme")).toBe("light");
  });

  it("「ダーク」をクリックすると dark が選択される", async () => {
    const user = userEvent.setup();
    renderToggle();
    await user.click(screen.getByRole("radio", { name: "ダーク" }));
    expect(screen.getByRole("radio", { name: "ダーク" })).toBeChecked();
  });

  it("「ダーク」をクリックすると html に .dark クラスが付与される", async () => {
    const user = userEvent.setup();
    renderToggle();
    await user.click(screen.getByRole("radio", { name: "ダーク" }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("「ライト」をクリックすると html から .dark クラスが除去される", async () => {
    document.documentElement.classList.add("dark");
    localStorage.setItem("theme", "dark");
    const user = userEvent.setup();
    renderToggle();
    await user.click(screen.getByRole("radio", { name: "ライト" }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("fieldset に legend が含まれる（スクリーンリーダー用）", () => {
    renderToggle();
    expect(screen.getByRole("group", { name: "テーマ選択" })).toBeInTheDocument();
  });
});

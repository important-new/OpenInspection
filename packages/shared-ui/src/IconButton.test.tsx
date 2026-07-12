import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { IconButton } from "./IconButton";
import { Icon } from "./Icon";

afterEach(cleanup);

describe("IconButton", () => {
  it("is square, icon-only, requires aria-label", () => {
    render(
      <IconButton aria-label="Close" size="md">
        <Icon name="x" />
      </IconButton>,
    );
    const btn = screen.getByRole("button", { name: "Close" });
    expect(btn.className).toContain("w-9");
    expect(btn.className).toContain("h-9");
    expect(btn.className).not.toContain("px-");
  });

  it("selected toggles aria-pressed", () => {
    render(
      <IconButton aria-label="Filter" selected>
        <Icon name="filter" />
      </IconButton>,
    );
    expect(screen.getByRole("button", { name: "Filter" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("unselected omits aria-pressed", () => {
    render(
      <IconButton aria-label="Filter">
        <Icon name="filter" />
      </IconButton>,
    );
    expect(screen.getByRole("button", { name: "Filter" }).hasAttribute("aria-pressed")).toBe(false);
  });
});

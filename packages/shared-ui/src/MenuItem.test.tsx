import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { MenuItem } from "./MenuItem";

afterEach(cleanup);

describe("MenuItem", () => {
  it("renders a full-width left-aligned menuitem", () => {
    render(<MenuItem>Duplicate</MenuItem>);
    const item = screen.getByRole("menuitem", { name: "Duplicate" });
    expect(item.className).toContain("w-full");
    expect(item.className).toContain("text-left");
  });

  it("danger tone uses bad-fg token", () => {
    render(<MenuItem tone="danger">Delete</MenuItem>);
    expect(screen.getByRole("menuitem", { name: "Delete" }).className).toContain("text-ih-bad-fg");
  });
});

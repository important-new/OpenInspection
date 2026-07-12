import { render, screen } from "@testing-library/react";
import { Button } from "./Button";

test("link variant renders borderless text action", () => {
  render(<Button variant="link">Browse library</Button>);
  const btn = screen.getByRole("button", { name: "Browse library" });
  expect(btn.className).toContain("text-ih-primary");
  expect(btn.className).toContain("hover:underline");
  expect(btn.className).not.toContain("bg-ih-primary");
});

test("danger-link variant renders borderless destructive text", () => {
  render(<Button variant="danger-link">Remove</Button>);
  const btn = screen.getByRole("button", { name: "Remove" });
  expect(btn.className).toContain("text-ih-bad-fg");
  expect(btn.className).toContain("hover:underline");
  expect(btn.className).not.toContain("bg-ih-bad");
});

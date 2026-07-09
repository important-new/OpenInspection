import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ItemEditor } from "../../../app/components/editor/ItemEditor";

// Minimal no-op prop bag; ItemEditor tolerates omitted optional callbacks.
const base = {
  sectionTitle: "Roof",
  onRating: vi.fn(),
  onNotes: vi.fn(),
  onNotesBlur: vi.fn(),
};

describe("ItemEditor — item.description hint", () => {
  it("renders the inspector-facing description hint for a rich item", () => {
    render(
      <ItemEditor
        {...base}
        item={{ id: "i1", label: "Roof Covering", type: "rich", description: "Walk the roof; note granule loss." }}
        result={{}}
      />
    );
    expect(screen.getByText("Walk the roof; note granule loss.")).toBeTruthy();
  });

  it("renders the description hint for a non-rich item too", () => {
    render(
      <ItemEditor
        {...base}
        item={{ id: "i2", label: "Year Built", type: "number", description: "From the county record." }}
        result={{}}
      />
    );
    expect(screen.getByText("From the county record.")).toBeTruthy();
  });

  it("omits the hint when no description is set", () => {
    const { container } = render(
      <ItemEditor {...base} item={{ id: "i3", label: "Attic", type: "rich" }} result={{}} />
    );
    expect(container.querySelector('[data-testid="item-description-hint"]')).toBeNull();
  });
});

/**
 * Module C — build a template canned-comment entry from a picked comment-library
 * string, and map each canned tab to the rating bucket used to hard-filter the
 * library drawer. Mirrors the shape produced by `addCannedToItem` in
 * `template-edit.tsx` (defects carry category/location/photos; info/limitations
 * do not). Kept pure so the wiring in the route is unit-testable without a DOM.
 */
import type { CannedComment } from "~/components/template/types";

export type CannedTab = "information" | "limitations" | "defects";

/**
 * Template tabs are authored per severity axis; the comment library filters by
 * `ratingBucket` (RatingBucketSchema = satisfactory | monitor | defect). This is
 * the fixed, structural mapping the template drawer uses to hard-filter — it does
 * NOT go through the name-heuristic `bucketForRatingId`.
 */
export const TAB_BUCKET: Record<CannedTab, "satisfactory" | "monitor" | "defect"> = {
  information: "satisfactory",
  limitations: "monitor",
  defects: "defect",
};

function prefixFor(tab: CannedTab): string {
  return tab === "defects" ? "rd_" : tab === "limitations" ? "rl_" : "ri_";
}

function defaultGenId(prefix: string): string {
  return `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function buildCannedFromText(
  tab: CannedTab,
  text: string,
  genId: (prefix: string) => string = defaultGenId,
): CannedComment {
  const entry: CannedComment = {
    id: genId(prefixFor(tab)),
    title: text.slice(0, 48),
    comment: text,
    default: false,
  };
  if (tab === "defects") {
    entry.category = "recommendation";
    entry.location = "";
    entry.photos = [];
  }
  return entry;
}

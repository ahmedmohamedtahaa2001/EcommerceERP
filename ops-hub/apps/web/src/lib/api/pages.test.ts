import { describe, expect, it } from "vitest";

import { fetchAllPages, PAGE_LIMIT } from "./pages";

describe("fetchAllPages", () => {
  it("follows the cursor until the last page", async () => {
    const calls: Array<string | undefined> = [];
    const pages: Record<
      string,
      { items: number[]; nextCursor: string | null }
    > = {
      start: { items: [1, 2], nextCursor: "c2" },
      c2: { items: [3, 4], nextCursor: "c3" },
      c3: { items: [5], nextCursor: null },
    };
    const rows = await fetchAllPages("items", async ({ limit, cursor }) => {
      expect(limit).toBe(PAGE_LIMIT);
      calls.push(cursor);
      return pages[cursor ?? "start"]!;
    });
    expect(rows).toEqual([1, 2, 3, 4, 5]);
    expect(calls).toEqual([undefined, "c2", "c3"]);
  });

  it("makes one request when there is no next page", async () => {
    let count = 0;
    const rows = await fetchAllPages("items", async () => {
      count += 1;
      return { items: ["a"], nextCursor: null };
    });
    expect(rows).toEqual(["a"]);
    expect(count).toBe(1);
  });
});

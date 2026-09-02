export interface OrderableItem {
  id: string;
  sortOrder: number;
}

export function swapSortOrder<T extends OrderableItem>(
  items: T[],
  itemId: string,
  direction: "up" | "down"
): T[] | null {
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  const index = sorted.findIndex((i) => i.id === itemId);
  if (index === -1) return null;

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= sorted.length) return null;

  const current = sorted[index];
  const target = sorted[targetIndex];

  return sorted.map((item) => {
    if (item.id === current.id) return { ...item, sortOrder: target.sortOrder };
    if (item.id === target.id) return { ...item, sortOrder: current.sortOrder };
    return item;
  });
}

export async function persistSortOrders(
  updateFn: (id: string, sortOrder: number) => Promise<void>,
  items: OrderableItem[]
): Promise<void> {
  for (const item of items) {
    await updateFn(item.id, item.sortOrder);
  }
}

export function nextSortOrder(items: OrderableItem[]): number {
  if (!items.length) return 0;
  return Math.max(...items.map((i) => i.sortOrder)) + 1;
}

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

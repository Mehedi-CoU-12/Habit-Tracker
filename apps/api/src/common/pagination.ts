/**
 * Shared shape for every paginated list the API returns:
 * `{ items, total, page, pageSize }`.
 */
export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

/**
 * Normalizes raw page/pageSize inputs into Prisma `skip`/`take` values.
 * Out-of-range values are clamped rather than rejected, so a client asking
 * for pageSize=1000 silently gets the maximum instead of a 400.
 */
export function pageParams(page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const safePage = Math.max(1, Math.floor(page));
  const safeSize = Math.min(Math.max(1, Math.floor(pageSize)), MAX_PAGE_SIZE);
  return {
    skip: (safePage - 1) * safeSize,
    take: safeSize,
    page: safePage,
    pageSize: safeSize,
  };
}

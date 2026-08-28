export const PAGE_SIZE = 50;

export function getPagination(items, page) {
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const paginatedItems = items.slice(startIndex, startIndex + PAGE_SIZE);

  return { paginatedItems, totalPages, safePage, startIndex };
}

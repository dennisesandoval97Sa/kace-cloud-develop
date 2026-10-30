export const SCHEMA_KEY_PAGE_SIZE = 'pageSize';

export const DEFAULT_PAGE_SIZE = 10;
export const MIN_PAGE_SIZE = 1;
export const MAX_PAGE_SIZE = 100;

export const PAGER_ROOT_CLASS = 'kace-edit-grid-pager';
export const PAGER_ITEMS_LABEL = 'Items por página:';
export const PAGER_TITLE_FIRST = 'Primera página';
export const PAGER_TITLE_PREV = 'Página anterior';
export const PAGER_TITLE_NEXT = 'Página siguiente';
export const PAGER_TITLE_LAST = 'Última página';

export function formatPagerRange(startItem, endItem, total) {
  return `${startItem} - ${endItem} de ${total}`;
}

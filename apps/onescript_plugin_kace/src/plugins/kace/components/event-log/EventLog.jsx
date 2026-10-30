import {
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { useEventLog } from '#plugins/kace/hooks/useEventLog.js';
import { formatUpdatedAt } from '#plugins/kace/utils/eventLogUtils.js';
import { toTitleCase } from '#plugins/kace/utils/stringUtils.js';
import {
  dedupeCreationsByEventTime,
  getEventDate,
  getEventTimeMs,
} from '#plugins/kace/components/event-log/lib/eventLogCreationDedupe.js';
import {
  isSheetContentOverflowing,
  isSheetPinnedAtBottom,
  shouldLoadMoreOnWheel,
  shouldShowLoadMoreButton,
} from '#plugins/kace/components/event-log/lib/eventLogSheetOverflow.js';
import './EventLog.css';
import '#plugins/kace/shared/styles/kace-disabled.css';
import { useKaceDisabled } from '#plugins/kace/hooks/useKaceDisabled.hook.js';

const SCROLL_THRESHOLD = 80;

/**
 * Groups detail rows by parent segment to avoid showing object fields as unrelated changes.
 * Example: "localidad [3] / municipio" + "localidad [3] / departamento" => one group.
 * @param {Array<{ key: string, oldValue: string, newValue: string }>} rows
 * @returns {Array<{ groupKey: string, items: Array<{ key: string, oldValue: string, newValue: string }> }>}
 */
function groupDetailRows(rows) {
  const source = Array.isArray(rows) ? rows : [];
  const grouped = new Map();
  source.forEach((row) => {
    const rawKey = typeof row?.key === 'string' ? row.key : '';
    const sepIndex = rawKey.indexOf(' / ');
    const groupKey = sepIndex >= 0 ? rawKey.slice(0, sepIndex) : rawKey;
    const fieldKey = sepIndex >= 0 ? rawKey.slice(sepIndex + 3) : rawKey;
    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, []);
    }
    grouped.get(groupKey).push({
      key: fieldKey,
      oldValue: row?.oldValue ?? '—',
      newValue: row?.newValue ?? '—',
    });
  });
  return Array.from(grouped.entries()).map(([groupKey, items]) => ({
    groupKey,
    items,
  }));
}

/**
 * @typedef Props
 * @prop {{ [x: string]: unknown }} component - `this.component` properties
 * @prop {string} [fieldPath] - Dot path in new_attributes / original_attributes (from Form.io schema)
 * @prop {string} [componentPath] - Runtime path of the Form.io instance (can include edit grid row index)
 * @prop {(value: any, flags: any, source: any) => any} updateValue - Function to update `this.value` (formio component instance) value
 * @prop {boolean} [disabled=false] - Disables interactions when Form.io sets disable
 * @prop {string|null} [contextCaseId=null] - Override entity ID for subcase context (bypasses URL params when truthy)
 * @prop {string} [eventLogInstanceId=''] - Form.io `component.id`; scopes storeService cache so multiple event logs do not collide.
 */

/**
 * @param {Props} props
 */
export const EventLog = ({
  component,
  updateValue,
  fieldPath: fieldPathProp,
  componentPath,
  disabled = false,
  contextCaseId = null,
  eventLogInstanceId = '',
}) => {
  const {
    disabled: isDisabled,
    readOnlyLock,
    className: disabledClassName,
  } = useKaceDisabled(disabled, { readOnlyStoreKey: null });
  const fieldPath = typeof fieldPathProp === 'string' ? fieldPathProp : '';
  const { state, actions } = useEventLog({
    fieldPath,
    componentPath,
    contextCaseId,
    eventLogInstanceId,
  });
  const {
    items,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    isSheetOpen,
    entityId,
    primaryEntity,
    isDynamicFieldPath,
  } = state;
  const { fetchHistory, loadMore, toggleSheet, getComparisonForItem } = actions;
  const sheetBodyRef = useRef(null);
  const sheetContentRef = useRef(null);
  const [sheetCanScroll, setSheetCanScroll] = useState(false);
  const [detailModal, setDetailModal] = useState({
    isOpen: false,
    title: '',
    rows: [],
  });

  const handleOpenSheet = () => {
    if (!isSheetOpen) {
      void fetchHistory();
    }
    toggleSheet();
  };

  useEffect(() => {
    if (isSheetOpen && items.length === 0 && !isLoading && !error) {
      void fetchHistory();
    }
  }, [isSheetOpen, items.length, isLoading, error, fetchHistory]);

  const handleScroll = useCallback(() => {
    const el = sheetBodyRef.current;
    if (!el || isLoadingMore || !hasMore || isLoading) return;
    if (!isSheetContentOverflowing(el, sheetContentRef.current)) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollTop + clientHeight >= scrollHeight - SCROLL_THRESHOLD) {
      void loadMore();
    }
  }, [loadMore, isLoadingMore, hasMore, isLoading]);

  const handleLoadMore = useCallback(() => {
    if (isDisabled || isLoadingMore || isLoading || !hasMore) return;
    void loadMore();
  }, [isDisabled, isLoadingMore, isLoading, hasMore, loadMore]);

  useEffect(() => {
    const el = sheetBodyRef.current;
    if (!el || !isSheetOpen) return undefined;

    const onWheel = (event) => {
      if (isDisabled) return;
      const contentOverflows = isSheetContentOverflowing(
        el,
        sheetContentRef.current
      );
      const pinnedAtBottom = isSheetPinnedAtBottom(el);
      if (
        !shouldLoadMoreOnWheel({
          deltaY: event.deltaY,
          isSheetScrollable: contentOverflows && !pinnedAtBottom,
          hasMore,
          isLoading,
          isLoadingMore,
          hasError: Boolean(error),
        })
      ) {
        return;
      }
      event.preventDefault();
      void loadMore();
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [
    isSheetOpen,
    isDisabled,
    hasMore,
    isLoading,
    isLoadingMore,
    error,
    loadMore,
  ]);

  const openDetailModal = useCallback((title, rows) => {
    setDetailModal({
      isOpen: true,
      title,
      rows: Array.isArray(rows) ? rows : [],
    });
  }, []);

  const closeDetailModal = useCallback(() => {
    setDetailModal({
      isOpen: false,
      title: '',
      rows: [],
    });
  }, []);

  const label = component?.label != null ? String(component.label) : 'Eventos';
  const visibleItems = useMemo(() => {
    const mapped = items.map((item) => {
      const isCreationByDates =
        item.new_attributes?.updated_at == null &&
        item.original_attributes?.updated_at == null;
      const comparisonResult = getComparisonForItem(item);
      const isCreationByPath =
        comparisonResult.kind === 'field' &&
        comparisonResult.isCreationForPath === true;
      const isCreation = isCreationByDates || isCreationByPath;
      const comparison = comparisonResult.rows;
      const hasComparison = comparison.length > 0;
      return {
        item,
        isCreation,
        comparison,
        hasComparison,
      };
    });

    // Solo filas con diff visible o marcadas como creación (evita timeline con fecha/autor y sin cambios).
    const filtered = mapped.filter(
      ({ isCreation, hasComparison }) => isCreation || hasComparison
    );
    const deduped = dedupeCreationsByEventTime(filtered);

    if (!fieldPath || !isDynamicFieldPath) {
      return deduped;
    }

    const nonCreationRows = deduped.filter((row) => !row.isCreation);
    const creationRows = deduped.filter((row) => row.isCreation);

    let singleCreationRow = null;
    if (creationRows.length > 0) {
      singleCreationRow = creationRows.reduce((best, cur) => {
        const bestMs = getEventTimeMs(best.item);
        const curMs = getEventTimeMs(cur.item);
        return curMs >= bestMs ? cur : best;
      });
    }

    const combined = singleCreationRow
      ? [...nonCreationRows, singleCreationRow]
      : [...nonCreationRows];
    combined.sort((a, b) => getEventTimeMs(b.item) - getEventTimeMs(a.item));
    return combined;
  }, [items, getComparisonForItem, fieldPath, isDynamicFieldPath]);
  const groupedDetailRows = useMemo(
    () => groupDetailRows(detailModal.rows),
    [detailModal.rows]
  );

  const measureSheetOverflow = useCallback(() => {
    setSheetCanScroll(
      isSheetContentOverflowing(sheetBodyRef.current, sheetContentRef.current)
    );
  }, []);

  useLayoutEffect(() => {
    if (!isSheetOpen) {
      setSheetCanScroll(false);
      return undefined;
    }

    measureSheetOverflow();

    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(measureSheetOverflow);
    if (sheetBodyRef.current) observer.observe(sheetBodyRef.current);
    if (sheetContentRef.current) observer.observe(sheetContentRef.current);
    return () => observer.disconnect();
  }, [isSheetOpen, measureSheetOverflow]);

  useLayoutEffect(() => {
    if (isSheetOpen && typeof ResizeObserver === 'undefined') {
      measureSheetOverflow();
    }
  }, [
    isSheetOpen,
    visibleItems.length,
    isLoading,
    isLoadingMore,
    error,
    measureSheetOverflow,
  ]);

  const showLoadMoreButton = shouldShowLoadMoreButton({
    hasMore,
    isSheetScrollable: sheetCanScroll,
    isLoading,
    isLoadingMore,
    hasError: Boolean(error),
  });

  if (!entityId || !primaryEntity) {
    return null;
  }

  return (
    <div className={`kace-event-log ${disabledClassName}`}>
      <button
        type="button"
        className="kace-event-log-trigger"
        onClick={handleOpenSheet}
        aria-label={isSheetOpen ? 'Cerrar historial' : label}
        disabled={isDisabled}
      >
        <i className="fa fa-history" aria-hidden="true" />
      </button>

      <aside
        className={`kace-event-log-sheet ${isSheetOpen ? 'kace-event-log-sheet--visible' : 'kace-event-log-sheet--hidden'}`}
        aria-hidden={!isSheetOpen}
      >
        <div className="kace-event-log-sheet-header">
          <h2 className="kace-event-log-sheet-title">Historial</h2>
          <button
            type="button"
            className="kace-event-log-sheet-close"
            onClick={toggleSheet}
            aria-label="Cerrar"
            disabled={isDisabled}
          >
            ×
          </button>
        </div>

        <div
          ref={sheetBodyRef}
          className="kace-event-log-sheet-body"
          onScroll={handleScroll}
        >
          <div ref={sheetContentRef} className="kace-event-log-sheet-content">
            {isLoading && (
              <div className="kace-event-log-loading" aria-busy="true">
                Cargando…
              </div>
            )}

            {error && !isLoading && (
              <div className="kace-event-log-error" role="alert">
                {error}
              </div>
            )}

            {!isLoading && !error && visibleItems.length === 0 && !hasMore && (
              <div className="kace-event-log-empty">
                No hay eventos para mostrar.
              </div>
            )}

            {!isLoading && !error && visibleItems.length > 0 && (
              <ul className="kace-event-log-timeline">
                {visibleItems.map(
                  ({ item, isCreation, comparison, hasComparison }) => {
                    const eventDate = getEventDate(item);
                    return (
                      <li
                        key={item.id}
                        className="kace-event-log-timeline-item"
                      >
                        <div className="kace-event-log-timeline-item-header">
                          {isCreation && (
                            <span className="kace-event-log-timeline-badge kace-event-log-timeline-badge--creation">
                              Creación
                            </span>
                          )}
                          <time className="kace-event-log-timeline-item-date">
                            {formatUpdatedAt(eventDate)}
                          </time>
                          <span className="kace-event-log-timeline-item-creator">
                            {toTitleCase(item.creator_name ?? 'No registrado')}
                          </span>
                        </div>
                        {hasComparison && !isCreation && (
                          <div className="kace-event-log-comparison-card">
                            <dl className="kace-event-log-comparison-list">
                              {comparison.map(
                                (
                                  { key, oldValue, newValue, details },
                                  rowIndex
                                ) => {
                                  const hasDetails =
                                    Array.isArray(details) &&
                                    details.length > 0;
                                  return (
                                    <div
                                      key={`${item.id}-${key}-${rowIndex}`}
                                      className="kace-event-log-comparison-row"
                                    >
                                      <dt>{key}</dt>
                                      <dd>
                                        <span
                                          className={`kace-event-log-comparison-old${oldValue === '—' ? ' kace-event-log-comparison-old--empty' : ''}`}
                                        >
                                          {oldValue}
                                        </span>
                                        <span className="kace-event-log-comparison-arrow">
                                          →
                                        </span>
                                        <span className="kace-event-log-comparison-new">
                                          {newValue}
                                        </span>
                                        {hasDetails && (
                                          <button
                                            type="button"
                                            className="btn btn-link btn-sm p-0 ml-2 align-baseline"
                                            onClick={() =>
                                              openDetailModal(key, details)
                                            }
                                            disabled={isDisabled}
                                          >
                                            Ver detalle
                                          </button>
                                        )}
                                      </dd>
                                    </div>
                                  );
                                }
                              )}
                            </dl>
                          </div>
                        )}
                      </li>
                    );
                  }
                )}
              </ul>
            )}

            {isLoadingMore && (
              <div className="kace-event-log-loading-more">Cargando más…</div>
            )}
          </div>

          {showLoadMoreButton && (
            <button
              type="button"
              className="kace-event-log-load-more"
              onClick={handleLoadMore}
              disabled={isDisabled}
            >
              Mostrar más
            </button>
          )}
        </div>
      </aside>
      {detailModal.isOpen && (
        <div
          className="kace-event-log-detail-modal-backdrop"
          role="dialog"
          aria-modal="true"
        >
          <div className="kace-event-log-detail-modal">
            <div className="kace-event-log-detail-modal-header">
              <h3 className="kace-event-log-detail-modal-title">
                {detailModal.title}
              </h3>
              <button
                type="button"
                className="kace-event-log-sheet-close"
                onClick={closeDetailModal}
                aria-label="Cerrar detalle"
                disabled={isDisabled}
              >
                ×
              </button>
            </div>
            <div className="kace-event-log-detail-modal-body">
              {groupedDetailRows.map((group, groupIndex) => (
                <div key={`${group.groupKey}-${groupIndex}`} className="mb-3">
                  {group.items.length > 1 && (
                    <h4 className="h6 mb-2 text-primary">{group.groupKey}</h4>
                  )}
                  <dl className="kace-event-log-comparison-list mb-0">
                    {group.items.map((detail, index) => (
                      <div
                        key={`${group.groupKey}-${detail.key}-${index}`}
                        className="kace-event-log-comparison-row"
                      >
                        <dt>
                          {group.items.length > 1 ? detail.key : group.groupKey}
                        </dt>
                        <dd>
                          <span
                            className={`kace-event-log-comparison-old${detail.oldValue === '—' ? ' kace-event-log-comparison-old--empty' : ''}`}
                          >
                            {detail.oldValue}
                          </span>
                          <span className="kace-event-log-comparison-arrow">
                            →
                          </span>
                          <span className="kace-event-log-comparison-new">
                            {detail.newValue}
                          </span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

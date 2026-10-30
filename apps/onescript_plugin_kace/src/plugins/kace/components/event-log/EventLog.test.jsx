import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventLog } from './EventLog.jsx';

const hookApi = {
  state: {},
  actions: {},
};

vi.mock('#plugins/kace/hooks/useEventLog.js', () => ({
  useEventLog: () => hookApi,
}));

vi.mock('#plugins/kace/hooks/useKaceDisabled.hook.js', () => ({
  useKaceDisabled: () => ({
    disabled: false,
    readOnlyLock: false,
    className: '',
  }),
}));

function historyItem(id, createdAtIso, creatorName = 'Ana Pérez') {
  return {
    id,
    entity_id: 'entity-1',
    changed_attributes: {},
    new_attributes: { id: 'entity-1', created_at: createdAtIso },
    original_attributes: {},
    creator_name: creatorName,
  };
}

const proto = HTMLElement.prototype;
const originalScrollHeight = Object.getOwnPropertyDescriptor(
  proto,
  'scrollHeight'
);
const originalClientHeight = Object.getOwnPropertyDescriptor(
  proto,
  'clientHeight'
);
const originalOffsetHeight = Object.getOwnPropertyDescriptor(
  proto,
  'offsetHeight'
);

describe('EventLog', () => {
  const fetchHistory = vi.fn();
  const loadMore = vi.fn();
  const toggleSheet = vi.fn();
  const getComparisonForItem = vi.fn(() => ({ kind: 'full', rows: [] }));
  let observerInstances;
  let bodyBox;
  let contentBox;

  function renderLog(stateOverrides = {}) {
    hookApi.state = {
      items: [],
      isLoading: false,
      isLoadingMore: false,
      hasMore: true,
      error: null,
      isSheetOpen: true,
      entityId: 'case-1',
      primaryEntity: 'cases',
      isDynamicFieldPath: false,
      ...stateOverrides,
    };
    hookApi.actions = {
      fetchHistory,
      loadMore,
      toggleSheet,
      getComparisonForItem,
    };
    return render(
      <EventLog component={{ label: 'Eventos' }} updateValue={vi.fn()} />
    );
  }

  function installGeometryStubs() {
    Object.defineProperty(proto, 'scrollHeight', {
      configurable: true,
      get() {
        if (this.classList?.contains('kace-event-log-sheet-body')) {
          return bodyBox.scrollHeight;
        }
        if (this.classList?.contains('kace-event-log-sheet-content')) {
          return contentBox.scrollHeight;
        }
        return 0;
      },
    });
    Object.defineProperty(proto, 'offsetHeight', {
      configurable: true,
      get() {
        if (this.classList?.contains('kace-event-log-sheet-content')) {
          return contentBox.scrollHeight;
        }
        return 0;
      },
    });
    Object.defineProperty(proto, 'clientHeight', {
      configurable: true,
      get() {
        return this.classList?.contains('kace-event-log-sheet-body')
          ? bodyBox.clientHeight
          : 0;
      },
    });
  }

  function restoreGeometryStubs() {
    if (originalScrollHeight) {
      Object.defineProperty(proto, 'scrollHeight', originalScrollHeight);
    } else {
      delete proto.scrollHeight;
    }
    if (originalClientHeight) {
      Object.defineProperty(proto, 'clientHeight', originalClientHeight);
    } else {
      delete proto.clientHeight;
    }
    if (originalOffsetHeight) {
      Object.defineProperty(proto, 'offsetHeight', originalOffsetHeight);
    } else {
      delete proto.offsetHeight;
    }
  }

  beforeEach(() => {
    fetchHistory.mockReset();
    loadMore.mockReset();
    toggleSheet.mockReset();
    getComparisonForItem.mockClear();
    observerInstances = [];
    bodyBox = { scrollHeight: 400, clientHeight: 600 };
    contentBox = { scrollHeight: 400 };
    installGeometryStubs();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb) {
          this.cb = cb;
          this.observed = [];
          this.disconnected = false;
          observerInstances.push(this);
        }
        observe(el) {
          this.observed.push(el);
        }
        disconnect() {
          this.disconnected = true;
        }
      }
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    restoreGeometryStubs();
  });

  it('calls loadMore when Mostrar más is clicked', () => {
    renderLog();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar más' }));
    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it('keeps Mostrar más when only the button inflates the container scrollHeight', () => {
    bodyBox = { scrollHeight: 629, clientHeight: 600 };
    contentBox = { scrollHeight: 560 };
    renderLog({
      items: [historyItem('c1', '2026-10-14T13:59:25.000Z')],
      hasMore: true,
    });
    expect(
      screen.getByRole('button', { name: 'Mostrar más' })
    ).toBeInTheDocument();
  });

  it('loads the next page on wheel-down and not on wheel-up', () => {
    const { container } = renderLog();
    const body = container.querySelector('.kace-event-log-sheet-body');
    body.dispatchEvent(
      new WheelEvent('wheel', { deltaY: 40, bubbles: true, cancelable: true })
    );
    body.dispatchEvent(
      new WheelEvent('wheel', { deltaY: -40, bubbles: true, cancelable: true })
    );
    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it('does not steal the wheel when content overflows unless pinned at the bottom', () => {
    bodyBox = { scrollHeight: 900, clientHeight: 600 };
    contentBox = { scrollHeight: 900 };
    const { container } = renderLog({
      items: [historyItem('c1', '2026-10-14T13:59:25.000Z')],
    });
    const body = container.querySelector('.kace-event-log-sheet-body');
    body.scrollTop = 250;
    body.dispatchEvent(
      new WheelEvent('wheel', { deltaY: 40, bubbles: true, cancelable: true })
    );
    expect(loadMore).not.toHaveBeenCalled();
    body.scrollTop = 340;
    fireEvent.scroll(body);
    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it('does not load more on scroll when only the button creates overflow', () => {
    bodyBox = { scrollHeight: 629, clientHeight: 600 };
    contentBox = { scrollHeight: 560 };
    const { container } = renderLog({
      items: [historyItem('c1', '2026-10-14T13:59:25.000Z')],
    });
    const body = container.querySelector('.kace-event-log-sheet-body');
    body.scrollTop = 20;
    fireEvent.scroll(body);
    expect(loadMore).not.toHaveBeenCalled();
  });

  it('loads the next page on wheel-down when overflowing content is pinned at the bottom', () => {
    bodyBox = { scrollHeight: 900, clientHeight: 600 };
    contentBox = { scrollHeight: 900 };
    const { container } = renderLog({
      items: [historyItem('c1', '2026-10-14T13:59:25.000Z')],
    });
    const body = container.querySelector('.kace-event-log-sheet-body');
    body.scrollTop = 300;
    body.dispatchEvent(
      new WheelEvent('wheel', { deltaY: 40, bubbles: true, cancelable: true })
    );
    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it('removes the wheel listener and disconnects ResizeObserver on unmount', () => {
    const { container, unmount } = renderLog();
    const body = container.querySelector('.kace-event-log-sheet-body');
    expect(observerInstances.length).toBeGreaterThan(0);

    unmount();
    body.dispatchEvent(
      new WheelEvent('wheel', { deltaY: 40, bubbles: true, cancelable: true })
    );

    expect(loadMore).not.toHaveBeenCalled();
    expect(observerInstances.every((observer) => observer.disconnected)).toBe(
      true
    );
  });

  it('shows a single Creación row for two history items with the same created_at and author', () => {
    const same = '2026-10-14T13:59:25.000Z';
    renderLog({
      items: [historyItem('c1', same), historyItem('c2', same)],
      hasMore: false,
    });
    expect(screen.getAllByText('Creación')).toHaveLength(1);
  });

  it('shows both Creación rows when the same created_at has different authors', () => {
    const same = '2026-10-14T13:59:25.000Z';
    renderLog({
      items: [
        historyItem('h1', same, 'Ana Pérez'),
        historyItem('h2', same, 'Luis'),
      ],
      hasMore: false,
    });
    expect(screen.getAllByText('Creación')).toHaveLength(2);
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('Luis')).toBeInTheDocument();
  });

  it('renders loading, error, empty and loading-more states', () => {
    const { rerender } = renderLog({ isLoading: true, items: [] });
    expect(screen.getByText('Cargando…')).toBeInTheDocument();

    hookApi.state = {
      ...hookApi.state,
      isLoading: false,
      error: 'Error al cargar el historial',
    };
    rerender(
      <EventLog component={{ label: 'Eventos' }} updateValue={vi.fn()} />
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Error al cargar el historial'
    );

    hookApi.state = {
      ...hookApi.state,
      error: null,
      hasMore: false,
      items: [],
    };
    rerender(
      <EventLog component={{ label: 'Eventos' }} updateValue={vi.fn()} />
    );
    expect(
      screen.getByText('No hay eventos para mostrar.')
    ).toBeInTheDocument();

    hookApi.state = {
      ...hookApi.state,
      hasMore: true,
      isLoadingMore: true,
      items: [historyItem('c1', '2026-10-14T13:59:25.000Z')],
    };
    rerender(
      <EventLog component={{ label: 'Eventos' }} updateValue={vi.fn()} />
    );
    expect(screen.getByText('Cargando más…')).toBeInTheDocument();
  });
});

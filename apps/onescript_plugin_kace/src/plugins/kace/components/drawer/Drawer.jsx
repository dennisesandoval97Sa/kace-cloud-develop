import useDrawer from '#plugins/kace/hooks/useDrawer.js';
import { useEffect, useState, useMemo, useRef } from 'react';
import { Button } from './component/Button';
import { StateModal } from './component/StateModal';
import { Table } from './component/Table';
import { columns } from './data/constant';
import {
  formattedDateWithDate,
  formetedName,
  MONTH_TYPE,
} from './data/processData';
import './Drawer.css';
import '#plugins/kace/shared/styles/kace-floating-controls.css';
import '#plugins/kace/shared/styles/kace-disabled.css';
import { useKaceDisabled } from '#plugins/kace/hooks/useKaceDisabled.hook.js';
import { KaceEngine } from '#plugins/kace/KaceEngine.js';

const MANAGEMENT_TYPES = {
  bulk: 'Actualización Masiva',
  manual: 'Actualización Manual',
};
const PAGE_SIZE = 5;

export const Drawer = ({ disabled = false }) => {
  const {
    disabled: isDisabled,
    readOnlyLock,
    className: disabledClassName,
  } = useKaceDisabled(disabled, { readOnlyStoreKey: null });
  const { state, actions } = useDrawer();
  const [fechaResolucion, setFechaResolucion] = useState(null);
  const [page, setPage] = useState(1);
  const [isDrawerLoading, setIsDrawerLoading] = useState(false);
  const containerRef = useRef(null);

  const kaceEngine = KaceEngine();
  const storeService = kaceEngine.getService('storeService');
  const case_id = storeService.get('cases.case_id');

  const {
    isMinimized,
    isOpen,
    data,
    caseStates,
    isDrawerVisible,
    users,
    caseData,
  } = state;

  const {
    toggleOpen,
    getData,
    getCaseStates,
    toggleDrawerVisibility,
    updateState,
    getUser,
    getCaseData,
  } = actions;

  useEffect(() => {
    setPage(1);
  }, [data]);

  useEffect(() => {
    if (!data?.length) return;

    if (data[0]?.fecha_resolucion) {
      setFechaResolucion(data[0].fecha_resolucion);
    }
  }, [data]);

  useEffect(() => {
    if (!data?.length) return;

    const ids = [...new Set(data.map((i) => i.actualizador))];

    ids.forEach((id) => {
      if (id) getUser(id);
    });
  }, [data]);

  const items = useMemo(() => {
    if (!data?.length) return [];

    const caseCreatedAt =
      caseData?.created_at ?? caseData?.aux_case?.created_at;

    return data.map((item, index) => {
      const isFirstTransition = index === data?.length - 1;
      const dateSource =
        item?.fecha_transicion ??
        (isFirstTransition ? caseCreatedAt : null) ??
        null;

      const user = users?.find((u) => u.login === item.actualizador);
      const management = MANAGEMENT_TYPES[item.update_source] || '-';

      return {
        id: item.id,
        date: formattedDateWithDate(dateSource, MONTH_TYPE.NUMBER),
        nextStatus: item.estado_siguiente || '—',
        group: item.grupo,
        responsibleName: formetedName(
          item?.responsable?.nombres,
          item?.responsable?.apellido1
        ),
        statusUpdatedBy: user
          ? formetedName(user?.nombres, user?.apellido1)
          : 'Cargando...',
        management,
      };
    });
  }, [data, users, caseData]);

  const visibleItems = useMemo(() => {
    return items.slice(0, page * PAGE_SIZE);
  }, [items, page]);

  useEffect(() => {
    const el = containerRef.current;

    if (!el) return;

    const needsMore =
      el.scrollHeight <= el.clientHeight && visibleItems.length < items.length;

    if (needsMore) {
      setPage((prev) => prev + 1);
    }
  }, [visibleItems, items]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;

    const isBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;

    if (isBottom && visibleItems.length < items.length) {
      setPage((prev) => prev + 1);
    }
  };

  const handleStateChange = async (transitionId) => {
    await updateState(transitionId);
    await getData();
    await getCaseStates();
  };

  const handleOpenDrawer = async () => {
    toggleDrawerVisibility();
    setIsDrawerLoading(true);
    try {
      await getCaseData();
      await getData();
      await getCaseStates();
    } catch {
      /* noop */
    } finally {
      setIsDrawerLoading(false);
    }
  };

  if (!case_id) return null;

  return (
    <div className={disabledClassName}>
      {/* Button */}
      <button
        type="button"
        className={`kace-drawer-toggle-button ${
          isDrawerVisible
            ? 'kace-drawer-toggle-button--visible'
            : 'kace-drawer-toggle-button--hidden'
        }`}
        onClick={handleOpenDrawer}
        disabled={isDisabled}
        title="Estados"
        aria-label="Estados"
      >
        Estados
      </button>

      {/* Drawer */}
      <nav
        className={`kace-drawer-overlay ${
          isMinimized ? 'kace-drawer-overlay--minimized' : ''
        } ${
          isDrawerVisible
            ? 'kace-drawer-overlay--visible'
            : 'kace-drawer-overlay--hidden'
        }`}
      >
        <div className="kace-drawer-header-actions">
          <Button
            className="kace-drawer-close-button"
            onClick={toggleDrawerVisibility}
            isDisabled={isDisabled}
          >
            ×
          </Button>
        </div>

        {!isMinimized && (
          <div className="kace-drawer-body">
            <div className="kace-drawer-title-states">
              <p className="kace-drawer-inside-title">Estados</p>

              <Button
                className="kace-btn-open-modal"
                onClick={toggleOpen}
                isDisabled={isDisabled}
              >
                +
              </Button>
            </div>

            {isDrawerLoading ? (
              <div className="d-flex justify-content-center align-items-center p-5">
                <div className="text-primary spinner-border" role="status">
                  <span className="sr-only">Cargando...</span>
                </div>
              </div>
            ) : (
              <div
                ref={containerRef}
                className="kace-drawer-table-container"
                onScroll={handleScroll}
              >
                <Table columns={columns} data={visibleItems} keyField="id" />

                {visibleItems.length < items.length && (
                  <div className="text-center p-2 text-muted">
                    Cargando más...
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Modal */}
      {isOpen && (
        <StateModal
          caseStates={caseStates}
          toggleOpen={toggleOpen}
          onStateChange={handleStateChange}
          fechaResolucion={fechaResolucion}
          disabled={isDisabled}
        />
      )}
    </div>
  );
};

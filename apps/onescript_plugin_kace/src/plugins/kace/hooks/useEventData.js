import { useEffect, useState } from 'react';
import { KaceEngine } from '#plugins/kace/KaceEngine.js';

function readGlobalConfigHydrated() {
  try {
    const store = KaceEngine()?.getService?.('storeService');
    return Boolean(store?.get?.('config.global_config'));
  } catch {
    return false;
  }
}

/**
 * Las secciones cuya data ya está en el store (por la respuesta de `/cases/:id`) deben
 * arrancar con loading=false aún si el componente monta después de que `Auth.jsx` emitió
 * los eventos `kace*Loading=false`. Sin esto, los componentes que se montan tarde pierden
 * el evento y se quedan con el spinner activo hasta que algo más lo emita.
 */
function readEmbeddedReadyFlags() {
  try {
    const store = KaceEngine()?.getService?.('storeService');
    if (!store?.get)
      return { states: false, attachments: false, description: false };
    const caseRow = store.get('cases.case_data');
    const hasCaseRow = caseRow && typeof caseRow === 'object';
    const states =
      Array.isArray(store.get('states.transitions_data')) ||
      (hasCaseRow &&
        (caseRow.transicion != null || caseRow.transitions_available != null));
    const attachments =
      Boolean(store.get('cases.attachments_prefetched')) ||
      (hasCaseRow &&
        (caseRow.attachments !== undefined ||
          caseRow.case_attachments !== undefined ||
          caseRow.caseAttachments !== undefined));
    const description =
      hasCaseRow &&
      (caseRow.descripcion_caso != null ||
        caseRow.descripcion_caso_id == null ||
        caseRow.descripcion_caso_id === '');
    return { states, attachments, description };
  } catch {
    return { states: false, attachments: false, description: false };
  }
}

const useEventData = (onEvent) => {
  const [data, setData] = useState({});
  const [error, setError] = useState(null);
  const [classificationsLoading, setClassificationsLoading] = useState(true);
  const [classificationsData, setClassificationsData] = useState(null);
  const [statesLoading, setStatesLoading] = useState(
    () => !readEmbeddedReadyFlags().states
  );
  /**
   * Alineado con `statesLoading`: true hasta auth / `kaceAuthData` o si el store ya trae
   * `global_config` (montaje tardío). Evita UI de "permiso denegado" antes de hidratar.
   */
  const [attachmentsLoading, setAttachmentsLoading] = useState(
    () => !readGlobalConfigHydrated() && !readEmbeddedReadyFlags().attachments
  );
  const [descriptionLoading, setDescriptionLoading] = useState(
    () => !readGlobalConfigHydrated() && !readEmbeddedReadyFlags().description
  );

  useEffect(() => {
    try {
      const store = KaceEngine()?.getService?.('storeService');
      if (store?.get?.('config.global_config')) {
        setAttachmentsLoading((prev) => (prev ? false : prev));
        setDescriptionLoading((prev) => (prev ? false : prev));
      }
      const flags = readEmbeddedReadyFlags();
      if (flags.states) setStatesLoading((prev) => (prev ? false : prev));
      if (flags.attachments)
        setAttachmentsLoading((prev) => (prev ? false : prev));
      if (flags.description)
        setDescriptionLoading((prev) => (prev ? false : prev));
    } catch {
      /* ignore */
    }

    // TODO: Validate where is this used and if it is necessary. from KaceData.js legacy.
    onEvent('kaceAuthData', (data) => {
      setData(data);
      setAttachmentsLoading(false);
      setDescriptionLoading(false);
    });
    onEvent('kaceAuthError', (data) => {
      setError(data);
      setAttachmentsLoading(false);
      setDescriptionLoading(false);
    });
    onEvent('kaceClassificationsLoading', (data) => {
      setClassificationsLoading(data);
    });
    onEvent('kaceClassificationsData', (data) => {
      setClassificationsData(data);
    });
    onEvent('kaceStatesLoading', (data) => {
      setStatesLoading(data);
    });
    onEvent('kaceAttachmentsLoading', (data) => {
      setAttachmentsLoading(data);
    });
    onEvent('kaceDescriptionLoading', (data) => {
      setDescriptionLoading(data);
    });
  }, []);

  return {
    data,
    error,
    classificationsLoading,
    classificationsData,
    statesLoading,
    attachmentsLoading,
    descriptionLoading,
  };
};

export default useEventData;

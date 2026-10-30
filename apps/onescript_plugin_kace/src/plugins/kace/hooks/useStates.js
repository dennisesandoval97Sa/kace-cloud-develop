import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useEventData from '#plugins/kace/hooks/useEventData.js';
import { KaceEngine } from '../KaceEngine';
import { buildEmbeddedTransitionsListFromCase } from '#plugins/kace/utils/hydrateEditCaseToStore.js';
import { remapAvailableStates } from '#plugins/kace/hooks/reclassifiedStates.helpers.js';

const readSubmissionTransitionId = (root) =>
  root?.submission?.data?.case_data?.case?.transicion_id ??
  root?.data?.case_data?.case?.transicion_id ??
  null;

/**
 * @param {Function} onEvent - Alta de listener en el componente Form.io.
 * @param {Function} handleChange
 * @param {object} root
 * @param {Function} [offEvent] - Baja del listener. Form.io no la necesita para funcionar, pero
 *   sin ella cada render vuelve a suscribir: `onEvent` es un `this.on.bind(this)` nuevo en cada
 *   `renderReactComponent`, así que la identidad cambia y el efecto se re-ejecuta.
 */
const UseStates = (onEvent, handleChange, root, offEvent) => {
  const { data, statesLoading } = useEventData(onEvent);
  const [currentFlowId, setCurrentFlowId] = useState();
  const [states, setStates] = useState([]);
  const [defaultState, setDefaultState] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const baselineTransitionIdRef = useRef(null);
  /**
   * Estados del flujo destino que dejó el precheck (MSKT-1392 OS-9).
   *
   * Vive en un ref y lo consume `transitionsHandler` en vez de aplicarse desde el handler del
   * evento: al reclasificar llegan DOS eventos —`kaceCaseReclassified` y, justo detrás,
   * `kaceClassificationsFlowChange`—, y si cada uno escribiera `states` por su lado el segundo
   * pisaría al primero con una lista vacía. Así sigue habiendo un único sitio que decide.
   *
   * @type {import('react').MutableRefObject<{flujoId: string, clasificacionId: string|null, states: Array<object>}|null>}
   */
  const reclassifiedStatesRef = useRef(null);
  const kaceEngine = KaceEngine();
  const storeService = kaceEngine.getService('storeService');
  const statesService = kaceEngine.getService('states');
  const caseData = storeService.get('cases.case_data');

  useEffect(() => {
    if (
      caseData?.transicion_id != null &&
      baselineTransitionIdRef.current == null
    ) {
      baselineTransitionIdRef.current = caseData.transicion_id;
    }
  }, [caseData?.transicion_id]);

  const solved_date = useMemo(
    () =>
      caseData?.fecha_resolucion
        ? new Date(caseData.fecha_resolucion).toDateString()
        : null,
    [caseData?.fecha_resolucion]
  );

  const resolveUserPick = useCallback(
    (nextStates, loadedCaseTransitionId) => {
      const fromStore = storeService.get('states.current_transition');
      if (fromStore?.transition_id) {
        return fromStore;
      }

      const baselineId =
        baselineTransitionIdRef.current ?? loadedCaseTransitionId ?? null;
      const submissionTransitionId = readSubmissionTransitionId(root);

      if (
        !submissionTransitionId ||
        !baselineId ||
        String(submissionTransitionId) === String(baselineId)
      ) {
        return null;
      }

      const fromNextStates = nextStates.find(
        (state) =>
          String(state.transition_id) === String(submissionTransitionId)
      );
      if (fromNextStates) {
        return fromNextStates;
      }

      return { transition_id: submissionTransitionId };
    },
    [root, storeService]
  );

  const applyUserPick = useCallback(
    (userPick, nextStates) => {
      if (!userPick?.transition_id) return;

      const resolvedPick =
        userPick.state_id != null
          ? userPick
          : (nextStates.find(
              (state) =>
                String(state.transition_id) === String(userPick.transition_id)
            ) ?? userPick);

      handleChange(userPick.transition_id, resolvedPick?.state_id ?? null);

      if (resolvedPick?.state_id != null) {
        setSelected(resolvedPick.state_id);
      }

      if (!storeService.get('states.current_transition') && resolvedPick) {
        storeService.set('states.current_transition', resolvedPick);
      }
    },
    [handleChange, storeService]
  );

  const transitionsHandler = useCallback(
    async (flujo_id = null) => {
      setIsLoading(true);
      try {
        if (!flujo_id) {
          setStates([]);
          setDefaultState(null);
          handleChange(null, null);
          return;
        }

        // Reclasificación: los estados del flujo destino ya vinieron del precheck. No se puede
        // caer al camino normal porque filtra por `estado_actual_id`, y el estado del caso todavía
        // es del flujo ANTERIOR: el filtro no empataría con nada y la lista saldría vacía.
        // El guardado ya aterrizó cuando el caso trae la clasificación destino: vive de verdad en
        // el flujo nuevo y tiene un estado suyo, así que el filtrado normal vuelve a ser correcto.
        const reclassifyLanded =
          reclassifiedStatesRef.current?.clasificacionId != null &&
          String(
            storeService.get('cases.case_data')?.clasificacion_id ?? ''
          ) === String(reclassifiedStatesRef.current.clasificacionId);
        if (reclassifyLanded) {
          reclassifiedStatesRef.current = null;
        }

        const reclassified = reclassifiedStatesRef.current;
        if (reclassified && String(reclassified.flujoId) === String(flujo_id)) {
          setStates(reclassified.states);
          // El "estado actual" del caso pertenece al flujo viejo; mostrarlo sería mentir.
          setDefaultState(null);
          setSelected(null);
          storeService.set('states.current_transition', null);
          storeService.set('states.current_flow_id', flujo_id);
          // Las cacheadas son del flujo anterior. Sin esto, cuando el ref se invalide tras
          // guardar, el camino normal vería el flujo ya actualizado y las reusaría sin refrescar.
          storeService.set('states.transitions_data', null);
          handleChange(null, null);
          return;
        }

        const storedFlowId = storeService.get('states.current_flow_id');
        let transitionsData = storeService.get('states.transitions_data');
        const loadedCaseRow = storeService.get('cases.case_data');
        const loadedTransitionId = loadedCaseRow?.transicion_id ?? null;

        if (
          String(storedFlowId ?? '') !== String(flujo_id ?? '') ||
          !Array.isArray(transitionsData)
        ) {
          const embedded = buildEmbeddedTransitionsListFromCase(loadedCaseRow);
          if (
            embedded &&
            Array.isArray(embedded.transitionsData) &&
            embedded.transitionsData.length > 0 &&
            String(embedded.flowId) === String(flujo_id)
          ) {
            transitionsData = embedded.transitionsData;
          } else {
            transitionsData = await statesService.fetchTransitionsData({
              flowId: flujo_id,
            });
          }
          storeService.set('states.current_flow_id', flujo_id);
          storeService.set('states.transitions_data', transitionsData ?? []);
        }

        if (!transitionsData.length) {
          setStates([]);
          setDefaultState(null);
          handleChange(null, null);
          return;
        }

        const currentTransitionData = transitionsData.find(
          ({ id }) => id === loadedTransitionId
        );

        if (currentTransitionData) {
          const nombre = await statesService.fetchStateName({
            state_id: currentTransitionData?.siguiente_estado_id,
          });
          setDefaultState({
            transition_id: currentTransitionData?.id,
            state_id: currentTransitionData?.siguiente_estado_id,
            nombre,
          });
        }

        const currentStateId =
          currentTransitionData?.siguiente_estado_id || null;
        const availableStates = transitionsData
          .filter(
            ({ estado_actual_id, status }) =>
              estado_actual_id === currentStateId && status === 1
          )
          .map(async ({ id, siguiente_estado_id }) => {
            const nombre = await statesService.fetchStateName({
              state_id: siguiente_estado_id,
            });
            return {
              transition_id: id,
              state_id: siguiente_estado_id,
              nombre,
            };
          });
        const nextStates = await Promise.all(availableStates);
        setStates(nextStates);

        const userPick = resolveUserPick(nextStates, loadedTransitionId);
        if (userPick) {
          applyUserPick(userPick, nextStates);
        } else if (currentTransitionData) {
          handleChange(
            currentTransitionData.id,
            currentTransitionData.siguiente_estado_id ?? null
          );
        }
      } catch {
        setStates([]);
      } finally {
        setIsLoading(false);
      }
    },
    [
      data,
      currentFlowId,
      handleChange,
      applyUserPick,
      resolveUserPick,
      storeService,
      statesService,
    ]
  );

  const handleState = useCallback(
    (state_id) => {
      const transition = states.filter((s) => s.state_id === state_id);
      const selectedTransition = transition.length ? transition[0] : null;
      if (!selectedTransition) return;
      handleChange(selectedTransition.transition_id, state_id);
      storeService.set('states.current_transition', selectedTransition);
      setSelected(state_id);
    },
    [states, handleChange, storeService]
  );

  useEffect(() => {
    (async () => {
      try {
        if (currentFlowId) {
          await transitionsHandler(currentFlowId);
        }
      } catch (error) {
        console.error('Error fetching transitions data:', error);
      }
    })();
  }, [currentFlowId, transitionsHandler]);

  useEffect(() => {
    const handleFlowChange = (flowId) => {
      baselineTransitionIdRef.current = null;
      storeService.set('states.current_transition', null);
      setSelected(null);
      handleChange(null, null);
      setCurrentFlowId(flowId);
    };
    onEvent('kaceClassificationsFlowChange', handleFlowChange);
    return () => offEvent?.('kaceClassificationsFlowChange', handleFlowChange);
  }, [handleChange, offEvent, onEvent, storeService]);

  /**
   * Llega ANTES que `kaceClassificationsFlowChange`: OS-8 lo emite al aprobar el precheck y la
   * propagación del `flujo_id` viene detrás. Aquí solo se deja el material listo; aplicarlo es
   * cosa de `transitionsHandler`, que corre con el flujo nuevo.
   */
  useEffect(() => {
    const handleReclassified = (payload) => {
      const flujoId = payload?.flujo_id;
      if (flujoId == null) {
        reclassifiedStatesRef.current = null;
        return;
      }
      reclassifiedStatesRef.current = {
        flujoId,
        clasificacionId: payload?.clasificacion_id ?? null,
        states: remapAvailableStates(
          payload?.states,
          payload?.transition_rules
        ),
      };
      baselineTransitionIdRef.current = null;
    };
    onEvent('kaceCaseReclassified', handleReclassified);
    return () => offEvent?.('kaceCaseReclassified', handleReclassified);
  }, [offEvent, onEvent]);

  return {
    defaultState,
    states,
    isLoading: isLoading || statesLoading,
    selected,
    solved_date,
    handleState,
  };
};

export default UseStates;

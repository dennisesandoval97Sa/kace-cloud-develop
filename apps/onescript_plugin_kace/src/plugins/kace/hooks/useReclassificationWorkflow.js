import { useCallback, useEffect, useRef, useState } from 'react';

import { storeService } from '#plugins/kace/services/storeService.js';
import {
  RECLASSIFICATION_PRECHECK_STORE_PATH,
  RECLASSIFICATION_REASON_STORE_PATH,
  RECLASSIFIED_EVENT,
} from '#plugins/kace/shared/reclassification.constants.js';
import { isPrecheckAbandoned } from '#plugins/kace/components/classifications/reclassificationPolicy.js';
import {
  clearReclassificationSession,
  hasReclassificationSession,
  markReclassificationSession,
  reclassificationSessionTarget,
} from '#plugins/kace/shared/reclassificationSession.js';
import { reclassificationErrorMessage } from '#plugins/kace/utils/reclassificationErrorMessage.js';

/**
 * Orquestación de la reclasificación de un caso (MSKT-1392), fuera de `Classifications.jsx`.
 *
 * Reúne lo que el componente tenía suelto entre su lógica de catálogo: el motivo y su escritura
 * diferida, el precheck contra el backend con su guarda anti-obsoletos, la cancelación y la
 * limpieza de un precheck confirmado que nunca se guardó. El componente se queda con el árbol de
 * clasificaciones y el render.
 *
 * El árbol y el caso llegan por `ref` a propósito: son estado que el componente ya mantiene, y
 * copiarlos aquí crearía una segunda fuente de verdad que se desincroniza.
 *
 * @param {object} params
 * @param {{ fetchReclassificationPrecheck: Function, handleErrorMessage: Function }} params.caseService
 * @param {(name: string, payload: unknown) => void} [params.emitEvent]
 * @param {string|null|undefined} params.caseId - Id del caso según el store.
 * @param {{ id?: string, clasificacion_id?: string }|null} params.caseData
 * @param {boolean} params.caseContextResolved - El caso ya se resolvió (o se sabe que no hay).
 * @param {boolean} params.reclassifying - Hay un destino distinto al del caso seleccionado.
 * @param {{ current: any }} params.caseDataRef
 * @param {{ current: any }} params.optionsRef - Árbol de clasificaciones vigente.
 * @param {{ current: boolean }} params.userChangedClassificationRef
 * @param {(selection: object, tree: any) => void} params.onRestoreSelection - Devuelve la selección
 *   al camino de la clasificación del caso al cancelar.
 * @param {(tree: any, clasificacionId: string|undefined) => object} params.resolveSelectionFor -
 *   Traduce una clasificación a la selección por niveles que el desplegable entiende.
 */
export function useReclassificationWorkflow({
  caseService,
  emitEvent,
  caseId,
  caseData,
  caseContextResolved,
  reclassifying,
  caseDataRef,
  optionsRef,
  userChangedClassificationRef,
  onRestoreSelection,
  resolveSelectionFor,
}) {
  /**
   * El motivo se hidrata del store: tras confirmar, el formulario destino remonta este hook
   * y un `useState('')` vacío lo reescribiría a null en el efecto de persistencia.
   */
  const [reclassificationReason, setReclassificationReason] = useState(() => {
    const stored = storeService.get(RECLASSIFICATION_REASON_STORE_PATH);
    return typeof stored === 'string' ? stored : '';
  });
  /**
   * Destino ya aprobado por el precheck. Hasta que exista, el formulario no se toca.
   * Tras el remount se recupera de la sesión en memoria —el store del precheck solo no
   * basta: el efecto de abandono lo trataría como huérfano.
   */
  const [confirmedClasificacionId, setConfirmedClasificacionId] = useState(() =>
    reclassificationSessionTarget(caseId)
  );
  const [isCheckingPrecheck, setIsCheckingPrecheck] = useState(false);
  /** Motivo por el que el backend rechazó el destino. Vacío = no hay bloqueo. */
  const [precheckBlockerMessage, setPrecheckBlockerMessage] = useState('');
  /**
   * Descarta respuestas obsoletas: si el asesor cambia de destino con un precheck en vuelo, la
   * respuesta vieja no debe aplicarse sobre la selección nueva.
   */
  const precheckRequestRef = useRef(0);

  /** OS-11 lee el motivo del store; aquí solo se decide CUÁNDO escribirlo. */
  const persistReason = useCallback((reason) => {
    storeService.set(
      RECLASSIFICATION_REASON_STORE_PATH,
      reason?.trim() || null
    );
  }, []);

  /**
   * Sin debounce: OS-11 lee este valor del store al guardar, y ese guardado puede llegar
   * segundos después de la última pulsación (probado con reclasificaciones hechas rápido, una
   * detrás de otra). Un debounce —incluso corto— deja una ventana en la que "Guardar" corre
   * antes de que el motivo haya llegado al store, guardando la reclasificación SIN motivo pese a
   * que el asesor sí escribió uno. `onBlur` ya no hace falta como adelanto: este efecto persiste
   * en cada cambio.
   */
  useEffect(() => {
    if (!reclassifying) return;
    persistReason(reclassificationReason);
  }, [reclassifying, reclassificationReason, persistReason]);

  /**
   * Volver a la clasificación original borra el motivo: el texto ya no describe ningún cambio.
   * Va en su propio efecto para que dependa del cambio de estado y no del tecleo.
   */
  useEffect(() => {
    if (reclassifying) return;
    if (hasReclassificationSession(caseId ?? caseData?.id)) return;

    persistReason('');
  }, [reclassifying, persistReason, caseId, caseData?.id]);

  /**
   * Confirmar no propaga por sí solo: primero pregunta al backend si el destino es viable (API-3).
   * Solo con `eligible` se suelta `confirmedClasificacionId`, que es lo que deja pasar al efecto
   * de propagación y dispara la recarga del formulario.
   *
   * El destino llega por argumento y no por parámetro del hook porque el componente lo deriva DE
   * `confirmedClasificacionId`, que sale de aquí: pasarlo de vuelta como entrada cerraría el ciclo.
   *
   * @param {{ clasificacion_id?: string, flujo_id?: string }|null} pendingReclassification
   */
  const confirmReclassification = useCallback(
    async (pendingReclassification) => {
      const target = pendingReclassification?.clasificacion_id ?? null;
      const targetCaseId =
        caseDataRef.current?.id ?? storeService.get('cases.case_id');
      if (target == null || !targetCaseId) return;

      const requestId = precheckRequestRef.current + 1;
      precheckRequestRef.current = requestId;
      setIsCheckingPrecheck(true);
      setPrecheckBlockerMessage('');

      try {
        const result = await caseService.fetchReclassificationPrecheck({
          caseId: targetCaseId,
          clasificacionId: target,
        });
        // El asesor cambió de destino mientras esto volaba: la respuesta ya no describe su selección.
        if (precheckRequestRef.current !== requestId) return;

        if (!result.eligible) {
          setPrecheckBlockerMessage(
            reclassificationErrorMessage(result.blocker) ||
              'El caso no puede reclasificarse a esta clasificación.'
          );
          return;
        }

        // Antes de propagar: OS-9 lee estos estados al escuchar el evento.
        // `case_id` no es decorativo: el store sobrevive al cambio de caso, y es lo que permite a
        // OS-11 distinguir este precheck de uno que quedó vivo de otro caso.
        storeService.set(RECLASSIFICATION_PRECHECK_STORE_PATH, {
          case_id: String(targetCaseId),
          clasificacion_id: target,
          states: result.states,
          transition_rules: result.transitionRules,
        });
        markReclassificationSession(targetCaseId, target);
        emitEvent?.(RECLASSIFIED_EVENT, {
          clasificacion_id: target,
          flujo_id: pendingReclassification?.flujo_id ?? null,
          states: result.states,
          transition_rules: result.transitionRules,
        });
        setConfirmedClasificacionId(target);
      } catch (error) {
        if (precheckRequestRef.current !== requestId) return;
        setPrecheckBlockerMessage(caseService.handleErrorMessage(error));
      } finally {
        if (precheckRequestRef.current === requestId) {
          setIsCheckingPrecheck(false);
        }
      }
    },
    [caseService, emitEvent, caseDataRef]
  );

  /**
   * El asesor se movió a otra rama del árbol: el destino anterior deja de existir.
   *
   * Cae el motivo escrito para él, la confirmación que se le dio y —esto es lo que no puede
   * olvidarse— su precheck GUARDADO: OS-11 lo lee del store al guardar, así que dejarlo vivo
   * reclasificaría al destino que el asesor acaba de abandonar, incluso si volvió a la
   * clasificación original del caso, sin que nada en pantalla lo anuncie.
   */
  const abandonCurrentTarget = useCallback(() => {
    setReclassificationReason('');
    setConfirmedClasificacionId(null);
    clearReclassificationSession();
    storeService.set(RECLASSIFICATION_PRECHECK_STORE_PATH, null);
    // Un precheck en vuelo respondía por el destino anterior.
    precheckRequestRef.current += 1;
    setIsCheckingPrecheck(false);
    setPrecheckBlockerMessage('');
  }, []);

  /**
   * Cancelar restaura el camino de la clasificación del caso. No basta con vaciar la selección:
   * eso haría caer el efecto de propagación en su rama de limpieza y emitiría un
   * `kaceClassificationsChange(null)` que recargaría el formulario, justo lo que se quiere evitar.
   */
  const cancelReclassification = useCallback(() => {
    const tree = optionsRef.current;
    const restored = resolveSelectionFor(
      tree,
      caseDataRef.current?.clasificacion_id
    );
    // Invalida un precheck en vuelo: su respuesta ya no describe ninguna selección viva.
    precheckRequestRef.current += 1;
    setIsCheckingPrecheck(false);
    setPrecheckBlockerMessage('');
    storeService.set(RECLASSIFICATION_PRECHECK_STORE_PATH, null);
    clearReclassificationSession();
    setConfirmedClasificacionId(null);
    setReclassificationReason('');
    if (Object.keys(restored).length) {
      onRestoreSelection(restored, tree);
    }
    // Devuelve el mando a la re-sincronización con el caso.
    userChangedClassificationRef.current = false;
  }, [
    optionsRef,
    caseDataRef,
    resolveSelectionFor,
    onRestoreSelection,
    userChangedClassificationRef,
  ]);

  /**
   * Cancelación implícita de una reclasificación confirmada que nunca se guardó.
   *
   * Corre en la misma re-sincronización con el caso que el efecto que rebaja
   * `userChangedClassificationRef`, porque es la misma situación vista desde el store: la UI ya
   * volvió a la clasificación del caso, así que el precheck que quedó vivo no describe nada que el
   * asesor esté haciendo. Dejarlo bloquearía todos los guardados posteriores de este caso
   * (`applyPendingReclassification` pediría un estado que este montaje ya no tiene).
   *
   * Depende del ORDEN: este hook se invoca antes de que el componente declare el efecto que pone
   * la bandera a `false`, y React corre los efectos en orden de declaración. Al revés, esa pata de
   * `hasLiveReclassification` sería siempre muerta.
   *
   * No se reutiliza `cancelReclassification`: aquí no hay selección que restaurar —el efecto de
   * re-sincronización ya la dejó en la del caso— ni precheck en vuelo que invalidar.
   */
  useEffect(() => {
    if (!caseContextResolved) return;
    if (
      !isPrecheckAbandoned({
        precheck: storeService.get(RECLASSIFICATION_PRECHECK_STORE_PATH),
        caseId: caseData?.id ?? caseId,
        caseClasificacionId: caseData?.clasificacion_id,
        hasLiveReclassification:
          confirmedClasificacionId != null ||
          userChangedClassificationRef.current ||
          reclassifying ||
          hasReclassificationSession(caseData?.id ?? caseId),
      })
    ) {
      return;
    }

    clearReclassificationSession();
    storeService.set(RECLASSIFICATION_PRECHECK_STORE_PATH, null);
    storeService.set(RECLASSIFICATION_REASON_STORE_PATH, null);
    setReclassificationReason('');
  }, [
    caseContextResolved,
    caseId,
    caseData?.id,
    caseData?.clasificacion_id,
    confirmedClasificacionId,
    reclassifying,
    userChangedClassificationRef,
  ]);

  return {
    reclassificationReason,
    setReclassificationReason,
    confirmedClasificacionId,
    setConfirmedClasificacionId,
    isCheckingPrecheck,
    precheckBlockerMessage,
    confirmReclassification,
    cancelReclassification,
    abandonCurrentTarget,
    /** `onBlur` del textarea: adelanta la escritura diferida antes de que el asesor pulse guardar. */
    persistReason,
  };
}

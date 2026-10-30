import { useRef } from 'react';
import {
  GLOBAL_CONFIG_PATHS,
  useGlobalConfig,
} from '#plugins/kace/hooks/useGlobalConfig.js';
import { useReclassifyPermission } from '#plugins/kace/hooks/useReclassifyPermission.js';
import { isReclassificationUnlocked } from '#plugins/kace/components/classifications/reclassificationPolicy.js';

/**
 * Gate de reclasificación (MSKT-1392). Combina el flag por tenant —puede resolver después del
 * montaje, por eso `useGlobalConfig` re-lee en `kaceAuthData`— CON el permiso de rol
 * `CaseReclassify` del agente (`useReclassifyPermission`, BUG-4) y las condiciones del caso, vía
 * `isReclassificationUnlocked`. Ambos checks son obligatorios: el flag global por sí solo
 * desbloquearía el desplegable para cualquier agente, tenga o no el permiso que el backend ya
 * exige al guardar. Vive fuera de `Classifications.jsx` porque esa condición gobierna varias
 * guardas distintas del componente y no tiene más estado propio que esos dos flags.
 *
 * El `ref` se entrega junto al valor porque varios callbacks (`loadClassifications`,
 * `handleSelectClassification`) necesitan leer el gate SIN volver a crearse cuando cambia —lo
 * consultan dentro de closures que ya existían antes de que el flag resolviera.
 *
 * @param {object} params
 * @param {Function} params.onEvent
 * @param {Function} [params.offEvent]
 * @param {boolean} params.caseHasClassification - El caso ya tiene `clasificacion_id`.
 * @param {boolean} params.caseIsClosed - El caso tiene `fecha_resolucion`.
 * @returns {{ reclassifyUnlocked: boolean, reclassifyUnlockedRef: { current: boolean } }}
 */
export function useReclassifyUnlockGate({
  onEvent,
  offEvent,
  caseHasClassification,
  caseIsClosed,
}) {
  const reclassifyGlobalFlag = useGlobalConfig(
    onEvent,
    GLOBAL_CONFIG_PATHS.ALLOW_CASE_RECLASSIFICATION,
    offEvent
  );
  const hasReclassifyPermission = useReclassifyPermission(onEvent, offEvent);
  const reclassifyUnlocked = isReclassificationUnlocked({
    globalFlagEnabled: reclassifyGlobalFlag,
    hasReclassifyPermission,
    caseHasClassification,
    caseIsClosed,
  });
  const reclassifyUnlockedRef = useRef(reclassifyUnlocked);
  reclassifyUnlockedRef.current = reclassifyUnlocked;

  return { reclassifyUnlocked, reclassifyUnlockedRef };
}

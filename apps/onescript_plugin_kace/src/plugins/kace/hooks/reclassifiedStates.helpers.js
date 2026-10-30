/**
 * Adapta la respuesta del precheck de reclasificación (MSKT-1392 API-3) a la forma que consume
 * `useStates`.
 *
 * API-3 responde la forma `case_available_states` —`{ transition, estado_actual, estado_siguiente }`—
 * y no filas crudas de `/transitions/search`. El remapeo ya existía disperso (el `modalInitCode`
 * del data-table lo hace inline); aquí queda en un solo sitio y con tests.
 */

/**
 * Nombre de la regla que condiciona cada transición, indexado por `transicion_id`.
 *
 * Una transición sin regla no aparece en la respuesta del backend: no tiene nada que condicionar.
 *
 * @param {unknown} transitionRules
 * @returns {Map<string, string>}
 */
function indexRuleNamesByTransition(transitionRules) {
  const index = new Map();
  if (!Array.isArray(transitionRules)) return index;
  for (const rule of transitionRules) {
    const transitionId = rule?.transicion_id;
    if (transitionId == null) continue;
    const key = String(transitionId);
    if (index.has(key)) continue;
    index.set(key, rule?.nombre ? String(rule.nombre) : '');
  }
  return index;
}

/**
 * @param {unknown} items - `states` del precheck, en forma `case_available_states`.
 * @param {unknown} transitionRules - `transition_rules` del precheck.
 * @returns {Array<{transition_id: string, state_id: string, nombre: string, hasRule: boolean, ruleName: string}>}
 */
export function remapAvailableStates(items, transitionRules = []) {
  if (!Array.isArray(items)) return [];

  const ruleNames = indexRuleNamesByTransition(transitionRules);

  return items.reduce((acc, item) => {
    const transitionId = item?.transition?.id;
    const stateId = item?.estado_siguiente?.id;
    // Sin transición o sin estado destino la fila no es seleccionable: `handleState` resuelve la
    // transición desde el estado elegido, y guardar necesita ambos.
    if (transitionId == null || stateId == null) return acc;

    const key = String(transitionId);
    acc.push({
      transition_id: key,
      state_id: String(stateId),
      nombre: item?.estado_siguiente?.nombre
        ? String(item.estado_siguiente.nombre)
        : '',
      hasRule: ruleNames.has(key),
      ruleName: ruleNames.get(key) ?? '',
    });
    return acc;
  }, []);
}

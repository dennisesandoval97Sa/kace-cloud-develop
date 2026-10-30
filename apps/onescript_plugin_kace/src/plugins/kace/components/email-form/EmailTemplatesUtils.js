import { storeService } from '#plugins/kace/services/storeService.js';

const VAR_REGEX = /{{\s*([A-Za-z0-9_.-]+)\s*}}/g;

/**
 * Builds the template context from storeService,
 * mirroring the backend's buildEmailTemplateContext + aliasContext.
 *
 * Mapped from actual caseData structure:
 *
 *   cases / caso           → caseData  (the full case object)
 *   clients / cliente      → caseData.cliente
 *   usuarios / responsable → caseData.responsable
 *   clasificaciones / clasificacion → caseData.clasificacion
 *   aux_cases / aux_casos  → caseData.aux_case.data flattened one level
 *                            e.g. { pruebaDM: { email, ciudad, ... } }
 *                            accessible as {{aux_cases.pruebaDM.email}} (nested)
 *                            OR as {{aux_cases.email}} (flat, first match wins)
 *   aux_clients            → {} (not present in caseData)
 *
 * @returns {Object}
 */
export function buildFrontendTemplateContext() {
  const store = storeService.get('cases') ?? {};
  const caseData = store.case_data ?? {};

  const cases = { ...caseData };
  const clients = { ...(caseData.cliente ?? {}) };
  const responsable = { ...(caseData.responsable ?? {}) };
  const clasificaciones = { ...(caseData.clasificacion ?? {}) };

  const auxRaw = caseData.aux_case?.data ?? {};
  const aux_cases = {
    ...auxRaw,
    ...Object.values(auxRaw).reduce(
      (acc, val) =>
        typeof val === 'object' && val !== null ? { ...acc, ...val } : acc,
      {}
    ),
  };

  const aux_clients = {};

  const estadoActual = caseData.estado_actual ?? {};
  const estadoSiguiente = caseData.estado_siguiente ?? {};

  return {
    cases,
    clients,
    usuarios: responsable,
    clasificaciones,
    aux_cases,
    aux_clients,
    estados: estadoSiguiente,
    estados_actual: estadoActual,
    estados_siguiente: estadoSiguiente,
    caso: cases,
    cliente: clients,
    responsable,
    clasificacion: clasificaciones,
    aux_casos: aux_cases,
    aux_clientes: aux_clients,
  };
}

/**
 * Replaces {{variable.path}} placeholders in a template string.
 *
 * @param {string} templateString
 * @param {Object} [context] - defaults to buildFrontendTemplateContext()
 * @param {boolean} [forEmail=false] - true when rendering an email recipient
 *   field (destinatario / copia / copia_oculta). For these fields, unresolved
 *   placeholders are preserved as the literal `{{key}}` so the form-level
 *   validator can detect the gap and the backend renderEmailsOrFail can
 *   raise InvalidArgumentError. For body / subject / aux fields, the
 *   default is empty string so the rendered email is clean.
 * @returns {string}
 */
export function replaceTemplateVariables(
  templateString,
  context,
  forEmail = false
) {
  if (!templateString) return templateString;
  const ctx = context ?? buildFrontendTemplateContext();

  return templateString.replace(VAR_REGEX, (original, key) => {
    const keys = key.split('.');
    let value = ctx;
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined || value === null) {
        return forEmail ? original : '';
      }
    }
    return typeof value === 'object' ? original : String(value);
  });
}

/**
 * Applies replaceTemplateVariables to all string fields of a template object.
 *
 * @param {{ destinatario: string, copia: string, copia_oculta: string, asunto: string, cuerpo: string }} template
 * @returns {{ destinatario: string, copia: string, copia_oculta: string, asunto: string, cuerpo: string }}
 */
export function resolveTemplate(template) {
  const t = template ?? {};
  const ctx = buildFrontendTemplateContext();
  return {
    ...t,
    destinatario: replaceTemplateVariables(t.destinatario ?? '', ctx, true),
    copia: replaceTemplateVariables(t.copia ?? '', ctx, true),
    copia_oculta: replaceTemplateVariables(t.copia_oculta ?? '', ctx, true),
    asunto: replaceTemplateVariables(t.asunto ?? '', ctx),
    cuerpo: replaceTemplateVariables(t.cuerpo ?? '', ctx),
  };
}

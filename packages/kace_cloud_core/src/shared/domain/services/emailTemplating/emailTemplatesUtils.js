import { Helper } from '../../../infrastructure/utils/Helper.js';
import { TenantContext } from '../../../infrastructure/context/TenantContext.js';
import { InvalidArgumentError } from '../../../errors/InvalidArgumentError.js';
import { Case } from '../../../../cases/index.js';
import createDayjsInstance from '../../../factories/DayjsFactory.js';

/**
 * Construye el contexto para reemplazar variables en la plantilla de correo.
 * @param {{
 *   entity: Aggregate,
 *   clientFinder: DomainClientFinder,
 *   userFinder: DomainUserFinder,
 *   classificationFinder: ClassificationFinder
 *   auxCasesFinder: AuxCasesFinder,
 *   auxClientsFinder: AuxClientsFinder
 * }} options
 * @returns {Promise<Object>} contexto para renderizar el template
 */
export async function buildEmailTemplateContext({
    entity,
    clientFinder,
    userFinder,
    classificationFinder,
    auxCasesFinder,
    auxClientsFinder,
    stateFinder = null,
    transitionFinder = null,
}) {
    const jsonEntity = entity.toJson();

    let clients = {};
    let usuarios = {};
    let clasificaciones = {};
    let aux_cases = {};
    let aux_clients = {};
    let estados_actual = {};
    let estados_siguiente = {};

    try {
        if (entity.cliente_id?.value) {
            const found = await clientFinder.execute(entity.cliente_id.value);
            clients = found?.toJson?.().data ?? {};
        }

        if (entity.responsable_id?.value || !(entity instanceof Case)) {
            const found = await userFinder.execute(entity.responsable_id.value);
            usuarios = found?.toJson?.() ?? {};
        }

        if (entity.clasificacion_id?.value) {
            const found = await classificationFinder.execute(entity.clasificacion_id.value, { skipCache: true });
            clasificaciones = found?.toJson?.().data ?? {};
        }

        if (auxCasesFinder && entity.id?.value) {
            const found = await auxCasesFinder.execute(entity.id.value, { skipCache: true });
            const rawData = found?.toJson?.().data?.data ?? {};
            aux_cases = rawData;
        }

        if (auxClientsFinder && entity.cliente_id?.value) {
            const found = await auxClientsFinder.execute(entity.cliente_id.value);
            aux_clients = found?.toJson?.().data?.data ?? {};
        }
        if (stateFinder && transitionFinder && entity.transicion_id?.value) {
            const transition = await transitionFinder.execute(entity.transicion_id.value, { skipCache: true });
            if (transition) {
                const actualId = transition.estado_actual_id?.value ?? null;
                const siguienteId = transition.siguiente_estado_id?.value ?? null;
                if (actualId) {
                    const found = await stateFinder.execute(actualId);
                    estados_actual = found?.toJson?.().data ?? {};
                }
                if (siguienteId) {
                    const found = await stateFinder.execute(siguienteId);
                    estados_siguiente = found?.toJson?.().data ?? {};
                }
            }
        }
    } catch (error) {
        Helper.logError(`Partial error while building the template context:`, { error: error.message });
    }

    return {
        cases: entity instanceof Case ? jsonEntity : undefined,
        jsonEntity,
        clients,
        usuarios,
        clasificaciones,
        aux_cases,
        aux_clients,
        estados_actual,
        estados_siguiente,
        estados: estados_siguiente,
    };
}

const VAR_REGEX = /{{\s*([A-Za-z0-9_.-]+)\s*}}/g;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Validates if a value is a valid ISO 8601 date string.
 * @param {*} value - The value to validate
 * @returns {boolean} true if value is a valid ISO 8601 date
 */
function isValidISODate(value) {
    if (value instanceof Date) return !isNaN(value.getTime());
    if (typeof value !== 'string') return false;
    if (!ISO_DATE_REGEX.test(value)) return false;
    const d = new Date(value);
    return !isNaN(d.getTime());
}

/**
 * Gets the tenant timezone from TenantContext.
 * Defaults to 'UTC' if context is unavailable.
 * @returns {string} IANA timezone identifier or UTC offset
 */
function getTenantTimezone() {
    try {
        const tenant = TenantContext.getTenant?.();
        return tenant?.timezone?.value ?? 'UTC';
    } catch (error) {
        Helper.logError('Error retrieving tenant timezone:', error);
        return 'UTC';
    }
}

/**
 * Formats an ISO date string to local timezone in YYYY/MM/DD HH:mm:ss format.
 * @param {string} dateString - ISO 8601 date string
 * @param {string} [timezone='UTC'] - IANA timezone identifier
 * @returns {string} Formatted date string in local timezone
 */
function formatDateToLocalTimezone(dateValue, tz = 'UTC') {
    try {
        const dayjsTz = createDayjsInstance({ timezoneName: tz });
        const d = dayjsTz(dateValue);
        if (!d.isValid()) return String(dateValue);
        return d.format('YYYY/MM/DD HH:mm:ss');
    } catch (error) {
        Helper.logError('Error formatting date to local timezone:', error);
        return String(dateValue);
    }
}

export function replaceTemplateVariables(templateString, originalContext, forEmail = false, tenantTimezone = null) {
    const aliasContext = {
        ...originalContext,
        caso: originalContext.cases,
        cliente: originalContext.clients,
        responsable: originalContext.usuarios,
        clasificacion: originalContext.clasificaciones,
        aux_casos: originalContext.aux_cases,
        aux_clientes: originalContext.aux_clients,
        estados: originalContext.estados,
        estados_actual: originalContext.estados_actual,
        estados_siguiente: originalContext.estados_siguiente,
    };

    const tz = tenantTimezone ?? getTenantTimezone();

    return templateString.replace(VAR_REGEX, (_, key) => {
        const keys = key.split('.');
        let value = aliasContext;
        for (const k of keys) {
            value = value?.[k];
            if (value === undefined) {
                return forEmail ? `{{${key}}}` : '';
            }
        }

        if (isValidISODate(value)) {
            value = formatDateToLocalTimezone(value, tz);
        }

        return value;
    });
}

export function parseEmailList(emailString) {
    return emailString
        .split(',')
        .map((email) => email.trim())
        .filter((email) => email.length > 0);
}

export function renderEmailsOrFail(fieldName, template, context, tenantTimezone = null) {
    const rendered = replaceTemplateVariables(template, context, true, tenantTimezone);
    const missing = [...rendered.matchAll(/{{\s*([\w.]+)\s*}}/g)].map((m) => m[1]);
    if (missing.length) {
        throw new InvalidArgumentError(`El campo "${fieldName}" tiene variables sin reemplazar: ${missing.join(', ')}`);
    }
    return parseEmailList(rendered);
}

/**
 * Resuelve los {{campos}} de una lista de destinatarios (array de strings) contra el contexto.
 * Cada elemento puede traer variables; un placeholder puede expandirse a varios correos.
 * @param {string} fieldName - nombre del campo (para mensajes de error)
 * @param {string[]} list - lista de destinatarios, posiblemente con variables
 * @param {Object} context - contexto de reemplazo
 * @param {string|null} [tenantTimezone]
 * @returns {string[]} lista de correos resueltos (vacía si no hay destinatarios)
 * @throws {InvalidArgumentError} si queda alguna variable sin resolver
 */
export function renderRecipientList(fieldName, list, context, tenantTimezone = null) {
    const joined = (list ?? []).join(',');
    if (!joined) {
        return [];
    }
    return renderEmailsOrFail(fieldName, joined, context, tenantTimezone);
}

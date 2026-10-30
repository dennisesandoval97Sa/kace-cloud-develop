import { ALLOWED_CRITERIA_FUNCTIONS } from '../../shared/criteria/allowedCriteriaFunctions.js';
import { parseActiveClientId } from './parseActiveClientId.js';

const FUNCTIONS = ALLOWED_CRITERIA_FUNCTIONS.conditional_functions;

/**
 * @param {{ items?: Array, userId?: string, userGroup?: string|null, rawActiveClient?: unknown }} params
 * @returns {{ kind: 'missing_active_group' } | { kind: 'empty' } | { kind: 'ok', items: Array }}
 */
export function resolveBoardRuntimeFunctions({ items, userId, userGroup, rawActiveClient }) {
    const list = Array.isArray(items) ? items : [];
    const hasGroup = Boolean(userGroup);
    const requiresGroup = list.some((item) => item.function_type === FUNCTIONS.LOGGED_IN_USER_GROUP);
    if (requiresGroup && !hasGroup) {
        return { kind: 'missing_active_group' };
    }

    const requiresClient = list.some((item) => item.function_type === FUNCTIONS.ACTIVE_CLIENT);
    const activeClientId = parseActiveClientId(rawActiveClient);
    if (requiresClient && !activeClientId) {
        return { kind: 'empty' };
    }

    const resolvers = {
        [FUNCTIONS.LOGGED_IN_USER]: userId,
        ...(hasGroup && { [FUNCTIONS.LOGGED_IN_USER_GROUP]: userGroup }),
        ...(activeClientId && { [FUNCTIONS.ACTIVE_CLIENT]: activeClientId }),
    };

    const next = list.map((item) => {
        if (item.function_type && item.function_type in resolvers) {
            return { ...item, value: resolvers[item.function_type] };
        }
        return { ...item };
    });

    return { kind: 'ok', items: next };
}

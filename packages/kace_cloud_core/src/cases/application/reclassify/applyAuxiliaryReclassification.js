import { CASE_RECLASSIFY_REASON_REQUIRED, CASE_RECLASSIFY_TRANSITION_REQUIRED } from '@kace/error-codes';
import { CustomError } from '../../../shared/errors/CustomError.js';
import { isAuxiliaryReclassification } from './isAuxiliaryReclassification.js';

export const AUXILIARY_RECLASSIFICATION_COMMENT_REQUIRED =
    'A reclassification comment of at least 3 characters is required.';

export const AUXILIARY_RECLASSIFICATION_TRANSITION_REQUIRED = 'A destination transition is required to reclassify.';

function present(value) {
    return value != null && value !== '';
}

function commentDescripcion(comment) {
    return typeof comment?.descripcion === 'string' ? comment.descripcion.trim() : '';
}

function hasDestinationTransition(caseValue) {
    const transicionId = caseValue?.transicion_id;
    if (transicionId == null) return false;
    return String(transicionId).trim() !== '';
}

function stripClassificationWrite(caseValue) {
    const next = { ...caseValue };
    delete next.clasificacion_id;
    delete next.current_clasificacion_id;
    return next;
}

/**
 * @param {object} params
 * @param {string} params.caseId
 * @param {object} params.caseValue
 * @param {string|null|undefined} [params.destino]
 * @param {string|null|undefined} [params.origenFormulario]
 * @param {string|null|undefined} [params.persistida]
 * @param {{ descripcion?: string }|undefined} params.comment
 * @param {{ execute: Function }} params.reclassifier
 * @param {{ execute: Function }} [params.caseFinder]
 * @param {Object|null} [params.pendingAuxData] - `aux_cases.data` the same request saves after
 *   reclassifying; the folio is generated against it, not against the stored auxiliary.
 * @param {boolean} [params.overrideAuxArrays]
 * @returns {Promise<{ applied: boolean, caseValue: object }>}
 */
export async function applyAuxiliaryReclassification({
    caseId,
    caseValue,
    destino,
    origenFormulario,
    persistida,
    comment,
    reclassifier,
    caseFinder,
    pendingAuxData = null,
    overrideAuxArrays = false,
}) {
    const resolvedDestino = destino !== undefined ? destino : caseValue?.clasificacion_id;
    const resolvedOrigen = origenFormulario !== undefined ? origenFormulario : caseValue?.current_clasificacion_id;

    let resolvedPersistida = persistida;
    if (resolvedPersistida === undefined && caseFinder && present(resolvedDestino)) {
        const persisted = await caseFinder.execute(caseId);
        resolvedPersistida = persisted?.clasificacion_id?.value ?? null;
    }

    if (!isAuxiliaryReclassification({ destino: resolvedDestino, persistida: resolvedPersistida })) {
        return { applied: false, caseValue: stripClassificationWrite(caseValue) };
    }

    const descripcion = commentDescripcion(comment);
    if (descripcion.length < 3) {
        throw new CustomError(AUXILIARY_RECLASSIFICATION_COMMENT_REQUIRED, 400, [], CASE_RECLASSIFY_REASON_REQUIRED);
    }

    if (!hasDestinationTransition(caseValue)) {
        throw new CustomError(
            AUXILIARY_RECLASSIFICATION_TRANSITION_REQUIRED,
            400,
            [],
            CASE_RECLASSIFY_TRANSITION_REQUIRED
        );
    }

    const reclassifySlice = { clasificacion_id: resolvedDestino };
    for (const key of ['transicion_id', 'grupo_id', 'responsable_id', 'updated_at', 'updated_by']) {
        const value = caseValue[key];
        if (value != null) {
            reclassifySlice[key] = value;
        }
    }

    await reclassifier.execute(caseId, reclassifySlice, {
        clasificacionSnapshot: present(resolvedOrigen) ? resolvedOrigen : resolvedPersistida,
        comment: { descripcion },
        ...(pendingAuxData ? { pendingAuxData, overrideAuxArrays } : {}),
    });

    return { applied: true, caseValue: stripClassificationWrite(caseValue) };
}

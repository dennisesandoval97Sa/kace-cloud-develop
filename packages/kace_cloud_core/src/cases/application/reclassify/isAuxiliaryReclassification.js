function present(value) {
    return value != null && value !== '';
}

/**
 * True when the auxiliary body would persist a classification that is not the one
 * already stored. Intent is `destino !== persistida`, not the form snapshot pair:
 * omitting `current_clasificacion_id` must not skip CaseReclassifier.
 *
 * @param {object} params
 * @param {string|null|undefined} params.destino
 * @param {string|null|undefined} params.persistida
 * @returns {boolean}
 */
export function isAuxiliaryReclassification({ destino, persistida }) {
    return present(destino) && present(persistida) && String(destino) !== String(persistida);
}

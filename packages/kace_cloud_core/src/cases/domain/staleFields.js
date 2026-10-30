import {
    CASE_TRANSITION_STALE,
    CASE_RESPONSIBLE_STALE,
    CASE_CLIENT_STALE,
    CASE_CLASSIFICATION_STALE,
    CASE_GROUP_STALE,
} from '@kace/error-codes';

export const STALE_SNAPSHOT_MESSAGE = 'Field was not updated because it changed after the form was loaded';

/**
 * Un CAS que el llamador declaró OBLIGATORIO no encontró su snapshot.
 *
 * El CAS por defecto degrada: el campo no se escribe, el resto del caso sí, y el conflicto viaja
 * como aviso en `writeOutcome`. Hay flujos donde esa degradación no vale —reclasificar deja el
 * caso con la transición del flujo destino y la clasificación vieja, que es un estado imposible—,
 * así que se lanza DENTRO de la transacción para que el guardado entero se deshaga.
 *
 * No trae código público a propósito: quién es el conflicto y cómo se le llama al cliente lo
 * decide el caso de uso que declaró la obligación, no `CaseUpdater`.
 */
export class StaleSnapshotWriteError extends Error {
    /** @param {string} field - Columna del caso cuyo CAS no coincidió. */
    constructor(field) {
        super(`${STALE_SNAPSHOT_MESSAGE}: ${field}`);
        this.name = 'StaleSnapshotWriteError';
        this.field = field;
    }
}

/**
 * Canonical CAS field table. Adding a field here is the only list that
 * `enabledStaleFields`, the evaluator, and the snapshot-conditional write share.
 */
export const STALE_FIELDS = [
    {
        field: 'transicion_id',
        snapshotKey: 'current_transicion_id',
        code: CASE_TRANSITION_STALE,
        dbKey: 'transicionId',
        resultKey: 'transitionSnapshot',
        writeFlag: 'transitionStaleAtWrite',
    },
    {
        field: 'responsable_id',
        snapshotKey: 'current_responsable_id',
        code: CASE_RESPONSIBLE_STALE,
        dbKey: 'responsableId',
        resultKey: 'responsableSnapshot',
        writeFlag: 'responsableStaleAtWrite',
    },
    {
        field: 'cliente_id',
        snapshotKey: 'current_cliente_id',
        code: CASE_CLIENT_STALE,
        dbKey: 'clienteId',
        resultKey: 'clienteSnapshot',
        writeFlag: 'clienteStaleAtWrite',
    },
    {
        field: 'clasificacion_id',
        snapshotKey: 'current_clasificacion_id',
        code: CASE_CLASSIFICATION_STALE,
        dbKey: 'clasificacionId',
        resultKey: 'clasificacionSnapshot',
        writeFlag: 'clasificacionStaleAtWrite',
    },
    {
        field: 'grupo_id',
        snapshotKey: 'current_grupo_id',
        code: CASE_GROUP_STALE,
        dbKey: 'grupoId',
        resultKey: 'grupoSnapshot',
        writeFlag: 'grupoStaleAtWrite',
    },
];

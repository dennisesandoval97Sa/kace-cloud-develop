/**
 * Regla unica de acceso a un tablero: el creador, los usuarios con acceso explicito y
 * los miembros del grupo con acceso.
 *
 * La misma condicion la aplica el repositorio en SQL (`applyActorAccessScope`, que sirve
 * tanto a searchAvailableBoards como al recorte del listado); esta es la version
 * autoritativa para las comprobaciones por tablero. Permiso de modulo y acceso al tablero
 * son comprobaciones distintas: tener BoardsUpdate habilita la accion, no el acceso a un
 * tablero concreto.
 *
 * Criterio entre listar y abrir: no hay ninguno. El listado devuelve exactamente los
 * tableros que esta politica autoriza a abrir, salvo para la llave maestra administrativa
 * (ver isBoardAdmin), que ve y opera todos los tableros del tenant.
 */
export class BoardAccessPolicy {
    /**
     * @param {Board|null} board
     * @param {{userId: string, groupId?: string, isBoardAdmin?: boolean}} actor
     *   isBoardAdmin: el llamante ya verifico la llave maestra administrativa
     *   (`boards.BoardsAccessAll` bajo el rol administrador). Sin esta via un tablero cuyo
     *   creador causo baja y cuyas listas de acceso quedaron obsoletas no lo puede
     *   recuperar nadie por API: no se lista, no se abre, no se edita y no se borra.
     * @returns {boolean}
     */
    static canAccess(board, { userId, groupId, isBoardAdmin = false } = {}) {
        if (!board || !userId) return false;
        if (isBoardAdmin) return true;

        const accessUsers = board.access_users?.value;
        const accessGroups = board.access_groups?.value;
        const createdBy = board.created_by?.value;

        const isCreator = Boolean(createdBy) && createdBy === userId;
        const hasUserAccess = Array.isArray(accessUsers) && accessUsers.includes(userId);
        const hasGroupAccess = Boolean(groupId) && Array.isArray(accessGroups) && accessGroups.includes(groupId);

        return isCreator || hasUserAccess || hasGroupAccess;
    }
}

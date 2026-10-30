export class ValidateActiveGroupMembership {
    /** @type {(userId: string, groupId: string) => Promise<object|null>} */
    #findRelationship;
    /** @type {(groupId: string) => Promise<object|null>} */
    #findGroup;
    /** @type {(userId: string) => Promise<void>} */
    #clearActiveGroup;

    /**
     * @param {Object} deps
     * @param {(userId: string, groupId: string) => Promise<object|null>} deps.findRelationship
     * @param {(groupId: string) => Promise<object|null>} deps.findGroup
     * @param {(userId: string) => Promise<void>} deps.clearActiveGroup
     */
    constructor({ findRelationship, findGroup, clearActiveGroup }) {
        this.#findRelationship = findRelationship;
        this.#findGroup = findGroup;
        this.#clearActiveGroup = clearActiveGroup;
    }

    /**
     * Validates whether the user still belongs to an active group and clears
     * `usuarios.grupo_activo` when the requested group is the user's current
     * active group but membership is gone or the group is inactive/missing.
     *
     * @param {Object} input
     * @param {string} input.userId
     * @param {string} input.groupId
     * @param {string|null} input.currentGrupoActivo
     * @returns {Promise<{ belongs_to_group: boolean, current_grupo_activo: string|null }>}
     */
    async execute({ userId, groupId, currentGrupoActivo }) {
        const [relationship, group] = await Promise.all([
            this.#findRelationship(userId, groupId),
            this.#findGroup(groupId),
        ]);

        const relationshipExists = Boolean(relationship);
        const groupIsActive = Boolean(group) && group.isActive();
        const isCurrentActiveGroup = groupId === currentGrupoActivo;
        const belongsToGroup = relationshipExists && groupIsActive && isCurrentActiveGroup;

        let resolvedGrupoActivo = currentGrupoActivo ?? null;

        if (isCurrentActiveGroup && (!relationshipExists || !groupIsActive)) {
            await this.#clearActiveGroup(userId);
            resolvedGrupoActivo = null;
        }

        return {
            belongs_to_group: belongsToGroup,
            current_grupo_activo: resolvedGrupoActivo,
        };
    }
}

/**
 * Maps group membership rows into MultiSelectUsers listValues shape.
 * Empty/missing memberships must yield [] so the selector clears stale chips.
 *
 * @param {Array<{ usuario_id?: string, nombre?: string }>|null|undefined} relatedUsers
 * @returns {Array<{ id: string, label: string }>}
 */
export const mapRelatedUsersToListValues = (relatedUsers) => {
    if (!Array.isArray(relatedUsers)) {
        return [];
    }

    return relatedUsers
        .filter((user) => user?.usuario_id)
        .map(({ usuario_id, nombre }) => ({
            id: usuario_id,
            label: nombre ?? "",
        }));
};

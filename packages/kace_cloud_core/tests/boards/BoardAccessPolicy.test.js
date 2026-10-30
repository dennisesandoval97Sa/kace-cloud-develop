import { BoardAccessPolicy } from '../../src/boards/domain/BoardAccessPolicy.js';

const CREATOR_ID = '26c77e59-ed50-46ac-b889-1d7535ae528a';
const GRANTED_USER_ID = '8cff49cb-0566-45e8-babd-c758ae2c4a48';
const GRANTED_GROUP_ID = '1ec99523-7501-4024-b1e3-716d79772427';
const OUTSIDER_ID = '77383205-bab1-4bb2-9d89-c44290a18518';
const OTHER_GROUP_ID = 'f4cb545c-7356-4c65-a82b-2edd62ac212b';

/** Board expone value objects; la policy solo lee `.value`, asi que basta con esta forma. */
const board = ({ access_users = [], access_groups = [], created_by = CREATOR_ID } = {}) => ({
    access_users: { value: access_users },
    access_groups: { value: access_groups },
    created_by: { value: created_by },
});

describe('BoardAccessPolicy', () => {
    it('grants access to the creator regardless of group', () => {
        expect(BoardAccessPolicy.canAccess(board(), { userId: CREATOR_ID })).toBe(true);
        expect(BoardAccessPolicy.canAccess(board(), { userId: CREATOR_ID, groupId: OTHER_GROUP_ID })).toBe(true);
    });

    it('grants access to a user listed in access_users', () => {
        const target = board({ access_users: [GRANTED_USER_ID] });
        expect(BoardAccessPolicy.canAccess(target, { userId: GRANTED_USER_ID })).toBe(true);
    });

    it('grants access when the active group is listed in access_groups', () => {
        const target = board({ access_groups: [GRANTED_GROUP_ID] });
        expect(BoardAccessPolicy.canAccess(target, { userId: OUTSIDER_ID, groupId: GRANTED_GROUP_ID })).toBe(true);
    });

    it('denies access to a user outside creator, access_users and access_groups', () => {
        const target = board({ access_users: [GRANTED_USER_ID], access_groups: [GRANTED_GROUP_ID] });
        expect(BoardAccessPolicy.canAccess(target, { userId: OUTSIDER_ID, groupId: OTHER_GROUP_ID })).toBe(false);
    });

    it('denies access when the user has no active group and the board only grants by group', () => {
        const target = board({ access_groups: [GRANTED_GROUP_ID] });
        expect(BoardAccessPolicy.canAccess(target, { userId: OUTSIDER_ID })).toBe(false);
    });

    it('does not match undefined ids against empty access lists', () => {
        const target = board({ access_users: [undefined], access_groups: [undefined], created_by: undefined });
        expect(BoardAccessPolicy.canAccess(target, { userId: undefined, groupId: undefined })).toBe(false);
    });

    it('denies access when the board does not exist', () => {
        expect(BoardAccessPolicy.canAccess(null, { userId: CREATOR_ID })).toBe(false);
    });

    it('denies access when there is no actor', () => {
        expect(BoardAccessPolicy.canAccess(board(), {})).toBe(false);
        expect(BoardAccessPolicy.canAccess(board())).toBe(false);
    });

    describe('llave maestra administrativa', () => {
        /*
         * Tablero huerfano: el creador causo baja y las listas de acceso quedaron obsoletas.
         * Sin la llave maestra ningun principal puede leerlo, editarlo ni borrarlo por API,
         * y el unico arreglo seria un UPDATE manual en la base de cada tenant.
         */
        const orphanBoard = board({ access_users: [], access_groups: [], created_by: 'ex-empleado-id' });

        it('recovers an orphan board for a board admin', () => {
            expect(
                BoardAccessPolicy.canAccess(orphanBoard, {
                    userId: OUTSIDER_ID,
                    groupId: OTHER_GROUP_ID,
                    isBoardAdmin: true,
                })
            ).toBe(true);
        });

        it('keeps denying the orphan board without the master key', () => {
            expect(BoardAccessPolicy.canAccess(orphanBoard, { userId: OUTSIDER_ID, groupId: OTHER_GROUP_ID })).toBe(
                false
            );
            expect(
                BoardAccessPolicy.canAccess(orphanBoard, {
                    userId: OUTSIDER_ID,
                    groupId: OTHER_GROUP_ID,
                    isBoardAdmin: false,
                })
            ).toBe(false);
        });

        it('still requires an identified actor', () => {
            expect(BoardAccessPolicy.canAccess(orphanBoard, { isBoardAdmin: true })).toBe(false);
            expect(BoardAccessPolicy.canAccess(null, { userId: OUTSIDER_ID, isBoardAdmin: true })).toBe(false);
        });
    });
});

import { changedRelationshipRules } from '../src/userRelationships.mjs';

const ROLE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_ROLE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const GROUP_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

describe('changedRelationshipRules', () => {
    const stored = { rol_id: ROLE_ID, grupo_activo: GROUP_ID };

    it('checks no relationship when the payload re-sends the stored role and group', () => {
        expect(changedRelationshipRules({ rol_id: ROLE_ID, grupo_activo: GROUP_ID }, stored)).toEqual([]);
    });

    it('checks only the relationship whose value changes', () => {
        expect(changedRelationshipRules({ rol_id: OTHER_ROLE_ID, grupo_activo: GROUP_ID }, stored)).toEqual([
            { field: 'rol_id', table: 'roles' },
        ]);
    });

    it('checks no relationship the payload does not send', () => {
        expect(changedRelationshipRules({ nombres: 'Solo Nombre' }, stored)).toEqual([]);
    });

    it('checks a relationship set for the first time', () => {
        expect(changedRelationshipRules({ grupo_activo: GROUP_ID }, { rol_id: ROLE_ID, grupo_activo: null })).toEqual([
            { field: 'grupo_activo', table: 'grupos' },
        ]);
    });
});

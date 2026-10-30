import { applyDefaultActiveGroup } from '../src/activeGroup.mjs';

describe('applyDefaultActiveGroup', () => {
    it('defaults an omitted active group from the first selected group', () => {
        const groupId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

        expect(applyDefaultActiveGroup({ group_ids: [groupId] })).toEqual({
            group_ids: [groupId],
            grupo_activo: groupId,
        });
    });

    it('defaults an empty active group from the first selected group', () => {
        const groupId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

        expect(applyDefaultActiveGroup({ group_ids: [groupId], grupo_activo: '' })).toEqual({
            group_ids: [groupId],
            grupo_activo: groupId,
        });
    });

    it('keeps an explicit active group', () => {
        const activeGroupId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        const selectedGroupId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

        expect(
            applyDefaultActiveGroup({
                group_ids: [selectedGroupId],
                grupo_activo: activeGroupId,
            })
        ).toEqual({
            group_ids: [selectedGroupId],
            grupo_activo: activeGroupId,
        });
    });
});

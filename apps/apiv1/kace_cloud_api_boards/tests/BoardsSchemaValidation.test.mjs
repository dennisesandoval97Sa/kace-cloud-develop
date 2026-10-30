import { boardCreate, boardUpdate } from '../src/schemas.mjs';
import { SHARED_VISUAL_ICON_ALLOWLIST } from '@kace/core/src/shared/visual-options/sharedVisualOptions.js';

const validBoardPayload = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Tablero visual',
    description: 'Tablero con icono permitido',
    primary_entity: 'cases',
    criteria: {
        items: [
            {
                entity: 'cases',
                field: 'id',
                operator: 'eq',
                value: '11111111-1111-4111-8111-111111111111',
                type: 'and',
            },
        ],
    },
    page_size: 25,
    is_active: true,
    can_view_record: true,
    can_create_record: true,
    can_edit_record: true,
    can_admin_bulk_actions: false,
    can_agent_bulk_actions: false,
    can_admin_delete_record: false,
    can_agent_delete_record: false,
    icon_class: SHARED_VISUAL_ICON_ALLOWLIST[0],
    access_groups: ['11111111-1111-4111-8111-111111111111'],
    access_users: ['11111111-1111-4111-8111-111111111112'],
    relations: [],
    columns: [],
    havings: [],
    options: [],
    created_at: Date.now(),
    created_by: '11111111-1111-4111-8111-111111111111',
};

describe('Board schema visual allowlists', () => {
    it('accepts allowlisted icons on create', () => {
        expect(boardCreate.validate(validBoardPayload).error).toBeUndefined();
    });

    it('rejects manipulated icons on create', () => {
        const { error } = boardCreate.validate({ ...validBoardPayload, icon_class: 'check' });

        expect(error).toBeDefined();
    });

    it('rejects manipulated icons on update', () => {
        const { error } = boardUpdate.validate({ ...validBoardPayload, icon_class: 'warning' });

        expect(error).toBeDefined();
    });

    it('accepts clearing the icon to null on update', () => {
        const updatePayload = {
            name: 'Tablero visual',
            primary_entity: 'cases',
            criteria: {
                items: [
                    {
                        entity: 'cases',
                        field: 'id',
                        operator: 'eq',
                        value: '11111111-1111-4111-8111-111111111111',
                        type: 'and',
                    },
                ],
            },
            icon_class: null,
        };

        expect(boardUpdate.validate(updatePayload).error).toBeUndefined();
    });
});

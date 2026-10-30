import {
    findDisallowedRelationships,
    findMissingBaseRelationships,
    normalizeRelationship,
} from '../../src/search-authorization/relationshipMatcher.js';

describe('relationshipMatcher', () => {
    const baseRelationships = [
        {
            table: 'clients',
            type: 'left',
            condition: { source: 'cases.cliente_id', target: 'clients.id' },
        },
    ];

    it('normalizes relationship condition key order', () => {
        expect(
            normalizeRelationship({
                type: 'left',
                condition: { target: 'clients.id', source: 'cases.cliente_id' },
                table: 'clients',
            })
        ).toEqual({
            condition: { source: 'cases.cliente_id', target: 'clients.id' },
            table: 'clients',
            type: 'left',
        });
    });

    it('detects missing base relationships', () => {
        expect(findMissingBaseRelationships(baseRelationships, [])).toEqual(baseRelationships);
    });

    it('allows only explicitly allowlisted extra relationships', () => {
        const allowedRelationships = [
            {
                table: 'usuarios',
                type: 'left',
                condition: { source: 'cases.responsable_id', target: 'usuarios.id' },
            },
        ];
        const submitted = [
            ...baseRelationships,
            ...allowedRelationships,
            {
                table: 'roles',
                type: 'left',
                condition: { source: 'usuarios.rol_id', target: 'roles.id' },
            },
        ];

        expect(findDisallowedRelationships(baseRelationships, submitted, allowedRelationships)).toEqual([
            {
                condition: { source: 'usuarios.rol_id', target: 'roles.id' },
                table: 'roles',
                type: 'left',
            },
        ]);
    });
});

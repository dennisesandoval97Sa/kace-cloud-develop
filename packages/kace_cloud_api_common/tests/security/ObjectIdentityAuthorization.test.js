import { jest } from '@jest/globals';
import {
    applyServerManagedFields,
    assertCreateRouteUpdateAuthorized,
    buildBroadRelationshipRules,
    createRepositoryIdCollisionFinder,
    resolveCanonicalCreateIdentity,
    secureObjectCreatePayload,
} from '../../src/security/ObjectIdentityAuthorization.js';

describe('ObjectIdentityAuthorization helpers', () => {
    it('overwrites caller-controlled audit fields with server context', () => {
        const now = new Date('2026-04-23T12:00:00.000Z');
        const sanitized = applyServerManagedFields(
            {
                id: 'legacy-id',
                name: 'Client',
                created_by: 'attacker',
                created_at: '2000-01-01T00:00:00.000Z',
                updated_by: 'attacker',
                deleted_by: 'attacker',
                tenant_id: 'attacker-tenant',
                edited_by: 'attacker',
                edited_at: '2000-01-01T00:00:00.000Z',
            },
            {
                operation: 'create',
                userId: '11111111-1111-4111-8111-111111111111',
                now,
            }
        );

        expect(sanitized).toEqual({
            id: 'legacy-id',
            name: 'Client',
            created_by: '11111111-1111-4111-8111-111111111111',
            created_at: now,
        });
    });

    it('accepts a safe legacy UUID only after checking repository collision', async () => {
        const legacyId = '22222222-2222-4222-8222-222222222222';
        const find = jest.fn().mockResolvedValue(null);

        const { payload, decision } = await resolveCanonicalCreateIdentity({
            payload: { id: legacyId, name: 'safe' },
            allowLegacyId: true,
            resourceType: 'clients',
            endpoint: 'POST /clients',
            collisionFinders: [createRepositoryIdCollisionFinder({ find }, 'clients')],
        });

        expect(payload.id).toBe(legacyId);
        expect(decision).toBe('legacy_accepted');
        expect(find).toHaveBeenCalledTimes(1);
    });

    it('rejects a colliding legacy UUID without mutating the requested payload', async () => {
        const legacyId = '33333333-3333-4333-8333-333333333333';

        await expect(
            resolveCanonicalCreateIdentity({
                payload: { id: legacyId },
                allowLegacyId: true,
                resourceType: 'clients',
                endpoint: 'POST /clients',
                collisionFinders: [
                    async () => ({
                        source: 'clients',
                        exists: true,
                    }),
                ],
            })
        ).rejects.toMatchObject({
            code: 'legacy_id_collision',
            field: 'id',
            statusCode: 400,
        });
    });

    it('replaces request-body IDs for strict server-owned resources', async () => {
        const untrustedId = '44444444-4444-4444-8444-444444444444';
        const generatedId = '55555555-5555-4555-8555-555555555555';

        const { payload, decision } = await resolveCanonicalCreateIdentity({
            payload: { id: untrustedId, name: 'strict' },
            allowLegacyId: false,
            generateId: () => generatedId,
            resourceType: 'broker_mappers',
            endpoint: 'POST /broker-mappers',
        });

        expect(payload.id).toBe(generatedId);
        expect(decision).toBe('server_generated_replacement');
    });

    it('replaces malformed request-body IDs for strict server-owned resources', async () => {
        const generatedId = '55555555-5555-4555-8555-555555555555';

        const { payload, decision } = await resolveCanonicalCreateIdentity({
            payload: { id: 'not-a-uuid', name: 'strict' },
            allowLegacyId: false,
            generateId: () => generatedId,
            resourceType: 'clients',
            endpoint: 'POST /clients',
        });

        expect(payload.id).toBe(generatedId);
        expect(decision).toBe('server_generated_replacement');
    });

    it('does not run legacy collision checks for strict server-owned resources', async () => {
        const generatedId = '55555555-5555-4555-8555-555555555555';
        const collisionFinder = jest.fn(async () => ({ exists: true, source: 'clients' }));

        const { payload } = await resolveCanonicalCreateIdentity({
            payload: { id: '66666666-6666-4666-8666-666666666666' },
            allowLegacyId: false,
            generateId: () => generatedId,
            resourceType: 'clients',
            endpoint: 'POST /clients',
            collisionFinders: [collisionFinder],
        });

        expect(payload.id).toBe(generatedId);
        expect(collisionFinder).not.toHaveBeenCalled();
    });

    it('requires explicit update permission before a create route mutates an existing object', () => {
        const user = {
            hasPermission: jest.fn(() => false),
        };

        expect(() =>
            assertCreateRouteUpdateAuthorized({
                user,
                existingObject: { id: { value: '66666666-6666-4666-8666-666666666666' } },
                permission: {
                    role: 'agente',
                    moduleId: 'clients',
                    action: 'ClientsUpdate',
                },
                resourceType: 'clients',
                endpoint: 'POST /clients',
            })
        ).toThrow(/requires update authorization/);
    });

    it('secures broad create payloads with server audit fields, strict IDs, and relationship rules', async () => {
        const now = new Date('2026-04-27T10:00:00.000Z');
        const generatedId = '77777777-7777-4777-8777-777777777777';
        const requestId = '88888888-8888-4888-8888-888888888888';
        const caseId = '99999999-9999-4999-8999-999999999999';
        const repository = {
            table: jest.fn((table) => {
                expect(table).toBe('cases');
                return {
                    select: jest.fn().mockReturnThis(),
                    where: jest.fn().mockReturnThis(),
                    modify: jest.fn(function modify(callback) {
                        callback(this);
                        return this;
                    }),
                    first: jest.fn(async () => ({ id: caseId })),
                };
            }),
        };

        const secured = await secureObjectCreatePayload({
            payload: {
                id: requestId,
                caso_id: caseId,
                created_by: 'attacker',
                created_at: '2000-01-01T00:00:00.000Z',
            },
            userId: '11111111-1111-4111-8111-111111111111',
            now,
            generateId: () => generatedId,
            repository,
            endpoint: 'POST /aux-cases',
            resourceType: 'aux_cases',
        });

        expect(secured).toMatchObject({
            id: generatedId,
            caso_id: caseId,
            created_by: '11111111-1111-4111-8111-111111111111',
            created_at: now,
        });
        expect(repository.table).toHaveBeenCalledWith('cases');
    });

    it('builds explicit broad relationship rules only for recognized fields present in the payload', () => {
        expect(buildBroadRelationshipRules({ caso_id: 'case-id', free_text: 'ignore' })).toEqual([
            { field: 'caso_id', table: 'cases', notDeleted: false },
        ]);
    });

    it('maps authorization_id to the ws_rest_endpoints table (self-referential FK, not allowed_connections)', () => {
        expect(buildBroadRelationshipRules({ authorization_id: 'ep-id' })).toEqual([
            { field: 'authorization_id', table: 'ws_rest_endpoints', notDeleted: false },
        ]);
    });

    it('does not build relationship rules for external OneScript reference ids (not FKs to one-script)', () => {
        expect(
            buildBroadRelationshipRules({
                onescript_reference_id: '99999999-9999-4999-8999-999999999999',
                onescript_form_id: '88888888-8888-4888-8888-888888888888',
                filter_onescript_id: '77777777-7777-4777-8777-777777777777',
            })
        ).toEqual([]);
    });

    it('does not treat the ANS measurement enum `medicion_ans_id` as a broad relationship', () => {
        expect(buildBroadRelationshipRules({ medicion_ans_id: 'Hours' })).toEqual([]);
    });

    it('secures an ANS create payload without UUID-validating the `medicion_ans_id` enum', async () => {
        const now = new Date('2026-06-30T10:00:00.000Z');
        const generatedId = '77777777-7777-4777-8777-777777777777';
        const repository = {
            table: jest.fn(() => {
                throw new Error('repository.table should not be called for an ANS create payload');
            }),
        };

        const secured = await secureObjectCreatePayload({
            payload: {
                id: '6e23d9dd-3652-41b5-b9f3-21560b212d65',
                nombre: 'Test ans',
                intermedio: 2,
                vencido: 3,
                color_ans_inicial: '#66CC33',
                color_ans_intermedio: '#E8C468',
                color_ans_final: '#E76E50',
                medicion_ans_id: 'Hours',
                status: 1,
            },
            userId: '11111111-1111-4111-8111-111111111111',
            now,
            generateId: () => generatedId,
            repository,
            endpoint: 'POST /ans',
            resourceType: 'ans',
        });

        expect(secured).toMatchObject({ id: generatedId, medicion_ans_id: 'Hours' });
        expect(repository.table).not.toHaveBeenCalled();
    });

    it('authorizes relationships persisted as denormalized arrays of `{ id }` objects', async () => {
        const now = new Date('2026-04-27T10:00:00.000Z');
        const generatedId = '77777777-7777-4777-8777-777777777777';
        const groupId = '3824c61a-6368-4c5c-957f-769525109e85';
        let capturedWhere;
        const repository = {
            table: jest.fn((table) => {
                expect(table).toBe('grupos');
                return {
                    select: jest.fn().mockReturnThis(),
                    where: jest.fn(function where(clause) {
                        capturedWhere = clause;
                        return this;
                    }),
                    modify: jest.fn(function modify(callback) {
                        callback(this);
                        return this;
                    }),
                    whereNull: jest.fn().mockReturnThis(),
                    first: jest.fn(async () => ({ id: groupId })),
                };
            }),
        };

        const secured = await secureObjectCreatePayload({
            payload: {
                id: '88888888-8888-4888-8888-888888888888',
                // workspaces persist `groups` as a JSON array of `{ id }` objects, not scalar UUIDs
                groups: [{ id: groupId }],
            },
            userId: '11111111-1111-4111-8111-111111111111',
            now,
            generateId: () => generatedId,
            repository,
            endpoint: 'POST /workspaces',
            resourceType: 'workspaces',
        });

        expect(secured).toMatchObject({ id: generatedId, groups: [{ id: groupId }] });
        // the normalized scalar id (not the `{ id }` object) must reach the lookup query
        expect(capturedWhere).toEqual({ id: groupId });
    });
});

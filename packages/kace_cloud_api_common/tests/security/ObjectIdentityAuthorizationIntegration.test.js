import { KnexRepository } from '@kace/core/src/shared/infrastructure/persistence/KnexRepository.js';
import { globalUserId } from '@kace/database/seeds/20241125105900_usuario_base.js';
import { TestHelper } from '../helpers/TestHelper.js';
import { assertAuthorizedRelationships } from '../../src/security/ObjectIdentityAuthorization.js';

const ENDPOINT = 'POST /integration-test';
const RESOURCE_TYPE = 'integration_test';
const MISSING_USER_ID = '00000000-0000-4000-8000-000000000000';

describe('ObjectIdentityAuthorization (integration, real PG, search_path=public)', () => {
    let repository;

    beforeAll(async () => {
        const tenant = await TestHelper.getTenant();
        await TestHelper.resetSchemaAndMigrate(tenant);
        repository = new KnexRepository(tenant.buildKnexConfig(), 'usuarios');
    }, 60000);

    afterAll(async () => {
        await repository.destroyConnection();
    });

    it('autoriza una relación existente usando nombres de tabla calificados', async () => {
        await expect(
            assertAuthorizedRelationships({
                payload: { responsable_id: globalUserId },
                repository,
                actorId: globalUserId,
                tenantId: 'integration-tenant',
                endpoint: ENDPOINT,
                resourceType: RESOURCE_TYPE,
                relationships: [{ field: 'responsable_id', table: 'usuarios' }],
            })
        ).resolves.toBeUndefined();
    });

    it('rechaza una relación inexistente con 404', async () => {
        await expect(
            assertAuthorizedRelationships({
                payload: { responsable_id: MISSING_USER_ID },
                repository,
                actorId: globalUserId,
                tenantId: 'integration-tenant',
                endpoint: ENDPOINT,
                resourceType: RESOURCE_TYPE,
                relationships: [{ field: 'responsable_id', table: 'usuarios' }],
            })
        ).rejects.toMatchObject({
            code: 'relationship_unauthorized',
            field: 'responsable_id',
            statusCode: 404,
        });
    });
});

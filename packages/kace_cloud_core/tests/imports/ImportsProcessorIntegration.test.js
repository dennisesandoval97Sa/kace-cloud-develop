import { S3ImportsProcessor } from '../../src/imports/application/imports-processor/S3ImportsProcessor.js';
import { TenantContext } from '../../src/shared/index.js';
import LocalTenantRepository from '../../src/tenant/infrastructure/local/LocalTenantRepository.js';

import { getConnection } from '../knexfile.js';

const tenant = await new LocalTenantRepository().find();

describe('S3ImportsProcessor - Smoke Test', () => {
    let processor;

    beforeAll(async () => {
        const schema = tenant.db_schema?.value;
        if (schema && schema !== 'public') {
            const db = getConnection();
            await db.raw(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
            await db.raw(`
                DO $$
                DECLARE
                    t text;
                BEGIN
                    FOR t IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
                        EXECUTE format('CREATE OR REPLACE VIEW %I.%I AS SELECT * FROM public.%I', '${schema}', t, t);
                    END LOOP;
                END $$;
            `);
        }
    });

    afterAll(async () => {
        await processor?.destroy();
    });

    it('should start processing without crashing and return skipped null', async () => {
        await TenantContext.run(tenant, async () => {
            processor = new S3ImportsProcessor();

            const result = await processor.processPendingsImports();

            expect(result).toEqual({ skipped: null });
        });
    });
});

import { HttpStatusCode } from 'axios';
import { v4 as uuid } from 'uuid';
import { HttpResponse } from '@kace/api-common';
import { VALIDATION_ERROR } from '@kace/error-codes';
import { schemaCreate } from '../src/schemas.mjs';

function eventFixture() {
    return {
        headers: { origin: 'https://admin.appsmx.net' },
        kContext: { awsRequestId: 'custom-lists-request-1' },
        requestContext: { requestId: 'request-context-id' },
        tenant: { apps_debug: { value: 'false' } },
        tenantContext: {
            tenant: {
                apps_allowed_origins: { value: 'https://admin.appsmx.net' },
                apps_debug: { value: 'false' },
            },
        },
    };
}

describe('Custom Lists validation response', () => {
    it('does not expose aux_items Joi validation internals in the public response', () => {
        const payload = {
            id: uuid(),
            name: 'Test Pentest',
            is_active: true,
            aux_entity: 'cases',
            aux_items: [{ sn: null }],
            groups: [uuid()],
            created_at: null,
            created_by: uuid(),
        };
        const validationResult = schemaCreate.validate(payload, { abortEarly: false });

        expect(validationResult.error).toBeDefined();
        expect(JSON.stringify(validationResult.error.details)).toContain('aux_items');

        const response = HttpResponse.validationsFail({
            errors: validationResult.error,
            event: eventFixture(),
        }).toJson();
        const body = JSON.parse(response.body);
        const publicBody = JSON.stringify(body);

        expect(response.statusCode).toBe(HttpStatusCode.BadRequest);
        expect(body).toEqual({
            message: 'The request could not be processed.',
            data: { code: VALIDATION_ERROR },
            metadata: { request_id: 'custom-lists-request-1' },
        });
        expect(publicBody).not.toContain('aux_items');
        expect(publicBody).not.toContain('literal');
        expect(publicBody).not.toContain('is required');
        expect(publicBody).not.toContain('is not allowed');
    });
});

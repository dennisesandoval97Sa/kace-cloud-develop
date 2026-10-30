import { jest } from '@jest/globals';

const run = jest.fn(() => ({ toJson: () => ({ statusCode: 200 }) }));
const controller = jest.fn(() => ({ run }));
const interactionCasesController = jest.fn(() => ({ run }));
const reviewController = jest.fn(() => ({ run }));
const webhookController = jest.fn(() => ({ run }));

jest.unstable_mockModule('@kace/api-common', () => ({ withTenantContext: (fn) => fn }));
jest.unstable_mockModule('../src/Controller.mjs', () => ({ Controller: controller }));
jest.unstable_mockModule('../src/ControllerAssociateInteractionToCaso.mjs', () => ({
    ControllerAssociateInteractionToCaso: interactionCasesController,
}));
jest.unstable_mockModule('../src/ControllerReview.mjs', () => ({ ControllerReview: reviewController }));
jest.unstable_mockModule('../src/ControllerWebhook.mjs', () => ({ ControllerWebhook: webhookController }));

const { baseHandler } = await import('../src/handler.mjs');

const eventFor = (resource, httpMethod) => ({
    resource,
    httpMethod,
    tenantContext: { knexConfig: { client: 'pg' } },
});

describe('interactions Agent route dispatch', () => {
    beforeEach(() => jest.clearAllMocks());

    it('normalizes Agent search without changing the existing search route', async () => {
        await baseHandler(eventFor('/agent/search', 'POST'));
        await baseHandler(eventFor('/search', 'POST'));

        expect(controller).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ resource: '/search', originalResource: '/agent/search' }),
            { client: 'pg' }
        );
        expect(controller).toHaveBeenNthCalledWith(2, expect.objectContaining({ resource: '/search' }), {
            client: 'pg',
        });
        expect(controller.mock.calls[1][0].originalResource).toBeUndefined();
    });

    it.each([
        ['/agent/interaction-cases', 'POST', '/'],
        ['/agent/interaction-cases/{id}', 'GET', '/{id}'],
    ])('routes %s to the scoped interaction-case controller', async (resource, method, normalizedResource) => {
        await baseHandler(eventFor(resource, method));

        expect(interactionCasesController).toHaveBeenCalledWith(
            expect.objectContaining({ resource: normalizedResource, originalResource: resource }),
            { client: 'pg' }
        );
    });

    it.each(['/agent/{id}/review/claim', '/agent/{id}/review/release'])(
        'routes %s to the scoped review controller',
        async (resource) => {
            await baseHandler(eventFor(resource, 'POST'));

            expect(reviewController).toHaveBeenCalledWith(
                expect.objectContaining({ resource: '/', originalResource: resource }),
                { client: 'pg' }
            );
        }
    );
});

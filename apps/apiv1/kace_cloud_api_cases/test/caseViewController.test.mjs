import { jest } from '@jest/globals';

const executeSearch = jest.fn();
const hasPermission = jest.fn();
const resolveViewName = jest.fn();
const validateSearchSchema = jest.fn((value) => ({ value }));

jest.unstable_mockModule('@kace/api-common', () => ({
    HttpResponse: {
        ok: (payload) => ({ toJson: () => ({ statusCode: 200, body: JSON.stringify(payload) }) }),
        forbidden: (payload) => ({ toJson: () => ({ statusCode: 403, body: JSON.stringify(payload) }) }),
        validationsFail: (payload) => ({ toJson: () => ({ statusCode: 400, body: JSON.stringify(payload) }) }),
        internalServerError: (payload) => ({ toJson: () => ({ statusCode: 500, body: JSON.stringify(payload) }) }),
    },
    BaseController: class {
        constructor(event, knexConfig) {
            this.event = event;
            this.database_connection = knexConfig;
        }

        payload() {
            return this.event.payload;
        }

        async getGlobalConfig() {
            return {};
        }
    },
}));

jest.unstable_mockModule('@kace/api-common/src/validation/schemas/SearchSchema', () => ({
    SearchSchema: { validate: validateSearchSchema },
}));

jest.unstable_mockModule('@kace/core/src/cases', () => ({
    CaseViewNameResolver: jest.fn().mockImplementation(() => ({ resolve: resolveViewName })),
    KnexViewCaseRepository: jest.fn().mockImplementation(() => ({ repositoryName: 'view_cases' })),
    ViewCaseSearcher: jest.fn().mockImplementation(() => ({ execute: executeSearch })),
}));

jest.unstable_mockModule('@kace/core/src/shared/index.js', () => ({
    Helper: { logInfo: jest.fn(), logError: jest.fn() },
}));

const { ViewController } = await import('../src/caseViewController.mjs');

const createController = ({ payload }) => {
    const controller = new ViewController({ payload }, { client: 'mock' });
    controller.user = { hasPermission };
    return controller;
};

describe('ViewController actionSearch', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        hasPermission.mockReturnValue(true);
        resolveViewName.mockResolvedValue('view_casos');
        executeSearch.mockResolvedValue({
            toJson: () => ({ data: { items: [] }, metadata: { count: 0 } }),
        });
        validateSearchSchema.mockImplementation((value) => ({ value }));
    });

    it('cleans table prefixes inside grouped filters before searching the case view', async () => {
        const payload = {
            filter: [
                { field: 'cases.cliente_id', operator: 'eq', value: 'client-1', type: 'AND' },
                {
                    groupType: 'OR',
                    filters: [
                        { field: 'view_casos.nivel1', operator: 'ilike', value: 'sftp', type: 'OR' },
                        { field: 'usuarios.login', operator: 'ilike', value: 'sftp', type: 'OR' },
                    ],
                },
            ],
            limit: 20,
            offset: 0,
        };

        const response = await createController({ payload }).actionSearch();

        expect(response.toJson().statusCode).toBe(200);
        expect(executeSearch).toHaveBeenCalledWith(
            expect.objectContaining({
                filter: [
                    { field: 'cliente_id', operator: 'eq', value: 'client-1', type: 'AND' },
                    {
                        groupType: 'OR',
                        filters: [
                            { field: 'nivel1', operator: 'ilike', value: 'sftp', type: 'OR' },
                            { field: 'login', operator: 'ilike', value: 'sftp', type: 'OR' },
                        ],
                    },
                ],
            })
        );
    });
});

import { jest } from '@jest/globals';

const advancedExecute = jest.fn();
const searchAuthorize = jest.fn(({ query }) => query);

class SearchAuthorizationError extends Error {
    constructor() {
        super('Advanced Search query is not allowed for this role.');
        this.statusCode = 403;
    }
}

const HttpResponse = {
    ok: (payload) => ({ statusCode: 200, ...payload }),
    forbidden: (payload) => ({ statusCode: 403, ...payload }),
    validationsFail: (payload) => ({ statusCode: 400, ...payload }),
    internalServerError: (payload) => ({ statusCode: 500, ...payload }),
};

jest.unstable_mockModule('@kace/api-common', () => ({
    BaseController: class {
        constructor(event, knexConfig) {
            this.event = event;
            this.user = event.__user;
            this.repository = {};
            this.database_connection = knexConfig;
        }
        payload() {
            return JSON.parse(this.event.body || '{}');
        }
        getActionExecutionService() {
            return {};
        }
    },
    HttpResponse,
    SearchAuthorizationError,
    SearchAuthorizationService: jest.fn().mockImplementation(() => ({ authorize: searchAuthorize })),
}));

jest.unstable_mockModule('@kace/core/src/shared/domain/services/AdvancedSearch', () => ({
    AdvancedSearch: jest.fn().mockImplementation(() => ({ execute: advancedExecute })),
}));

const { Controller } = await import('../src/controller.mjs');

const makeController = () => {
    const event = {
        body: JSON.stringify({
            filter: [{ field: 'cliente_id', operator: 'eq', value: '7', type: 'AND' }],
            limit: null,
            offset: null,
        }),
        __user: { hasPermission: () => true, id: { value: 'u1' } },
    };
    const knexConfig = { client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true };
    const controller = new Controller(event, knexConfig);
    return controller;
};

describe('cases actionAdvanceSearch authorization', () => {
    beforeEach(() => {
        searchAuthorize.mockClear();
        advancedExecute.mockClear();
        advancedExecute.mockResolvedValue({ data: { items: [] }, metadata: { count: 0 } });
    });

    it('authorizes the advance-search query against cases.search before executing', async () => {
        const controller = makeController();
        await controller.actionAdvanceSearch();

        expect(searchAuthorize).toHaveBeenCalledWith(expect.objectContaining({ endpointKey: 'cases.search' }));
    });

    it('returns 403 when authorization denies the query', async () => {
        searchAuthorize.mockImplementationOnce(() => {
            throw new SearchAuthorizationError();
        });
        const controller = makeController();
        const response = await controller.actionAdvanceSearch();

        expect(response.statusCode).toBe(403);
        expect(advancedExecute).not.toHaveBeenCalled();
    });
});

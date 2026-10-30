import { jest } from '@jest/globals';

const distinctExecute = jest.fn();
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
    badRequest: (payload) => ({ statusCode: 400, ...payload }),
    internalServerError: (payload) => ({ statusCode: 500, ...payload }),
};

jest.unstable_mockModule('@kace/api-common', () => ({
    BaseController: class {
        constructor(event) {
            this.event = event;
            this.user = event.__user;
        }
    },
    HttpResponse,
    SearchAuthorizationError,
    SearchAuthorizationService: jest.fn().mockImplementation(() => ({ authorize: searchAuthorize })),
}));

// The controller imports report infra via barrels, so mock the barrels (and the
// report-executions repo it imports directly) to keep construction free of real
// Knex/S3 I/O. The relevant behaviour is overridden on the instance after construction.
jest.unstable_mockModule('@kace/core/src/reports/index.js', () => ({
    ExcelExporter: jest.fn().mockImplementation(() => ({})),
    ReportCreator: jest.fn().mockImplementation(() => ({ execute: jest.fn() })),
    ReportColumnFinder: jest.fn().mockImplementation(() => ({ execute: jest.fn() })),
    ReportDistinctValuesFinder: jest.fn().mockImplementation(() => ({ execute: distinctExecute })),
    KnexReportsViewRepository: jest.fn().mockImplementation(() => ({ destroyConnection: jest.fn() })),
}));

jest.unstable_mockModule('@kace/core/src/csv-export-views/index.js', () => ({
    S3StorageService: jest.fn().mockImplementation(() => ({})),
}));

jest.unstable_mockModule(
    '@kace/core/src/report-executions/infrastructure/persistence/KnexReportExecutionsRepository.js',
    () => ({
        KnexReportExecutionsRepository: jest.fn().mockImplementation(() => ({})),
    })
);

const { Controller } = await import('../src/Controller.mjs');

const vObj = (v) => ({ value: v });

const makeController = () => {
    const event = {
        queryStringParameters: { name: 'view_cases', field: 'estado', search: '' },
        __user: { hasPermission: () => true, id: { value: 'u1' } },
        tenantContext: {
            readerConfig: undefined,
            tenant: {
                aws_s3_region: vObj('us-east-1'),
                aws_s3_access_key_id: vObj('AKIATEST'),
                aws_s3_secret_access_key: vObj('secret'),
                aws_s3_bucket: vObj('test-bucket'),
            },
        },
    };
    // Pass a function as knexConfig so KnexRepository bypasses real Knex init.
    const controller = new Controller(event, jest.fn());
    controller.reportDistinctValuesFinder = { execute: distinctExecute };
    return controller;
};

describe('reports actionAdvanceSearch authorization', () => {
    beforeEach(() => {
        searchAuthorize.mockClear();
        distinctExecute.mockClear();
        distinctExecute.mockResolvedValue({ items: [], total: 0 });
    });

    it('authorizes against reports.search before fetching distinct values', async () => {
        const controller = makeController();
        await controller.actionAdvanceSearch();

        expect(searchAuthorize).toHaveBeenCalledWith(expect.objectContaining({ endpointKey: 'reports.search' }));
    });

    it('returns 403 when authorization denies the query', async () => {
        searchAuthorize.mockImplementationOnce(() => {
            throw new SearchAuthorizationError();
        });
        const controller = makeController();
        const response = await controller.actionAdvanceSearch();

        expect(response.statusCode).toBe(403);
        expect(distinctExecute).not.toHaveBeenCalled();
    });
});

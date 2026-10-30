import { BrokerMapperCreateSchema, BrokerMapperUpdateSchema } from '../src/BrokerMapperSchema.mjs';

describe('BrokerMapperCreateSchema', () => {
    it('rejects a mapper without a REST flow', () => {
        const { error } = BrokerMapperCreateSchema.validate({
            id: '991f1a99-1d75-4b7d-8bd7-379ab919bb70',
            name: 'Cases mapper',
            rules: [],
        });

        expect(error?.details).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    path: ['rest_flow_id'],
                    type: 'any.required',
                }),
            ])
        );
    });

    it('defaults missing rules to an empty array', () => {
        const { error, value } = BrokerMapperCreateSchema.validate({
            id: '991f1a99-1d75-4b7d-8bd7-379ab919bb70',
            name: 'Cases mapper',
            rest_flow_id: 'cases-flow',
        });

        expect(error).toBeUndefined();
        expect(value.rules).toEqual([]);
    });
});

describe('BrokerMapperUpdateSchema', () => {
    it('accepts partial updates that omit mapper required fields', () => {
        const { error, value } = BrokerMapperUpdateSchema.validate({
            queue: null,
        });

        expect(error).toBeUndefined();
        expect(value).toEqual({ queue: null });
    });

    it.each([
        [null, 'string.base'],
        ['', 'string.empty'],
    ])('rejects an explicitly cleared REST flow (%p)', (restFlowId, expectedType) => {
        const { error } = BrokerMapperUpdateSchema.validate({
            rest_flow_id: restFlowId,
        });

        expect(error?.details).toEqual([
            expect.objectContaining({
                path: ['rest_flow_id'],
                type: expectedType,
            }),
        ]);
    });
});

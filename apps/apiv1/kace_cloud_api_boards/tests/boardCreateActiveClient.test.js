const UUID = '11111111-1111-4111-8111-111111111111';
let boardCreate;

beforeAll(async () => {
    ({ boardCreate } = await import('../src/schemas.mjs'));
});

describe('boardCreate — active_client', () => {
    it('accepts function_type active_client with an empty value', () => {
        const { error } = boardCreate.validate(
            {
                id: UUID,
                name: 'Client cases',
                primary_entity: 'cases',
                criteria: {
                    items: [
                        {
                            entity: 'cases',
                            field: 'cliente_id',
                            operator: 'eq',
                            value: '',
                            type: 'and',
                            function_type: 'active_client',
                        },
                    ],
                },
            },
            { abortEarly: false }
        );
        expect(error).toBeUndefined();
    });
});

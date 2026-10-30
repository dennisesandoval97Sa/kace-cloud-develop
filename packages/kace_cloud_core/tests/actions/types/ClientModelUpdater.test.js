import { jest } from '@jest/globals';
import { ActionUpdateModel, Aggregates, Types } from '../../../src/action-update-model/index.js';
import { ClientModelUpdater } from '../../../src/actions/domain/types/ClientModelUpdater.js';
import ActionUpdateModelMother from '../../action-update-model/domain/ActionUpdateModelMother.js';
import ClientMother from '../../clients/domain/ClientMother.js';

describe('ClientModelUpdater', () => {
    let formulaEvaluator;
    let modelValueSaver;
    let clientModelUpdater;

    beforeEach(() => {
        formulaEvaluator = { executeForClient: jest.fn(async () => 'formula-value') };
        modelValueSaver = { executeV2: jest.fn(async () => true) };
        clientModelUpdater = new ClientModelUpdater(formulaEvaluator, modelValueSaver);
    });

    it('should return false when modelUpdate is not an instance of ActionUpdateModel', async () => {
        const client = ClientMother.getValidClient();

        const result = await clientModelUpdater.execute({}, client);

        expect(result).toBe(false);
        expect(modelValueSaver.executeV2).not.toHaveBeenCalled();
    });

    it('should return false when client is not an instance of Client', async () => {
        const modelUpdate = ActionUpdateModel.create(ActionUpdateModelMother.dto({ type: Types.ALFANUMERICO.value }));

        const result = await clientModelUpdater.execute(modelUpdate, {});

        expect(result).toBe(false);
        expect(modelValueSaver.executeV2).not.toHaveBeenCalled();
    });

    it('should save the raw model value for a non-formula, non-number type', async () => {
        const client = ClientMother.getValidClient();
        const modelUpdate = ActionUpdateModel.create(
            ActionUpdateModelMother.dto({
                type: Types.ALFANUMERICO.value,
                aggregate: Aggregates.CLIENTES.value,
                field: 'nombres',
                value: 'Texto plano',
                formula: null,
            })
        );

        const result = await clientModelUpdater.execute(modelUpdate, client);

        expect(result).toBe(true);
        expect(formulaEvaluator.executeForClient).not.toHaveBeenCalled();
        expect(modelValueSaver.executeV2).toHaveBeenCalledWith({
            modelName: Aggregates.CLIENTES.value,
            field: 'nombres',
            value: 'Texto plano',
            cliente_id: client.id.value,
        });
    });

    it('should default the saved value to null when the modelUpdate has no value', async () => {
        const client = ClientMother.getValidClient();
        const modelUpdate = ActionUpdateModel.create(
            ActionUpdateModelMother.dto({
                type: Types.ALFANUMERICO.value,
                aggregate: Aggregates.CLIENTES.value,
                field: 'nombres',
                value: null,
                formula: null,
            })
        );

        const result = await clientModelUpdater.execute(modelUpdate, client);

        expect(result).toBe(true);
        expect(modelValueSaver.executeV2).toHaveBeenCalledWith(expect.objectContaining({ value: null }));
    });

    it('should resolve the value through the formulaEvaluator for a formula type', async () => {
        const client = ClientMother.getValidClient();
        const modelUpdate = ActionUpdateModel.create(
            ActionUpdateModelMother.dto({
                type: Types.FORMULA.value,
                aggregate: Aggregates.CLIENTES.value,
                field: 'nombres',
            })
        );
        formulaEvaluator.executeForClient.mockResolvedValue('valor-desde-formula');

        const result = await clientModelUpdater.execute(modelUpdate, client);

        expect(result).toBe(true);
        expect(formulaEvaluator.executeForClient).toHaveBeenCalledWith(modelUpdate, client);
        expect(modelValueSaver.executeV2).toHaveBeenCalledWith(
            expect.objectContaining({ value: 'valor-desde-formula' })
        );
    });

    it('should cast the resolved value to a number for a number type', async () => {
        const client = ClientMother.getValidClient();
        const modelUpdate = ActionUpdateModel.create(
            ActionUpdateModelMother.dto({
                type: Types.NUMERO.value,
                aggregate: Aggregates.CLIENTES.value,
                field: 'nombres',
                value: '42',
                formula: null,
            })
        );

        const result = await clientModelUpdater.execute(modelUpdate, client);

        expect(result).toBe(true);
        expect(modelValueSaver.executeV2).toHaveBeenCalledWith(expect.objectContaining({ value: 42 }));
        expect(typeof modelValueSaver.executeV2.mock.calls[0][0].value).toBe('number');
    });

    it('should return false and swallow the error when modelValueSaver.executeV2 rejects', async () => {
        const client = ClientMother.getValidClient();
        const modelUpdate = ActionUpdateModel.create(
            ActionUpdateModelMother.dto({
                type: Types.ALFANUMERICO.value,
                aggregate: Aggregates.CLIENTES.value,
                field: 'nombres',
                value: 'x',
                formula: null,
            })
        );
        modelValueSaver.executeV2.mockRejectedValue(new Error('boom'));

        const result = await clientModelUpdater.execute(modelUpdate, client);

        expect(result).toBe(false);
    });
});

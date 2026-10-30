import { ActionUpdateModel, Aggregates, Formulas } from '../../../../src/action-update-model/index.js';
import { InvalidArgumentError } from '../../../../src/shared/errors/InvalidArgumentError.js';
import { KnexAuxCasesRepository } from '../../../../src/aux_casos/index.js';
import { KnexAuxClientsRepository } from '../../../../src/aux_clientes/index.js';
import { Case, KnexCaseRepository } from '../../../../src/cases/index.js';
import { KnexClientRepository } from '../../../../src/clients/index.js';
import { knexConfig } from '../../../knexfile.js';
import { FormulaEvaluator } from '../../../../src/actions/domain/FormulaEvaluator.js';
import { AuxCasesMother } from '../../../aux_casos/domain/AuxCasesMother.js';
import { AuxClientsMother } from '../../../aux_clientes/domain/AuxClientsMother.js';
import ActionUpdateModelMother from '../../../action-update-model/domain/ActionUpdateModelMother.js';
import CasesMother from '../../../cases/domain/CasesMother.js';
import ClientMother from '../../../clients/domain/ClientMother.js';
import dayjs from 'dayjs';
import { CaseFields } from '../../../../src/action-update-model/domain/CaseFields.js';
import { CustomerFields } from '../../../../src/action-update-model/domain/CustomerFields.js';
import { PasswordEncoder } from '../../../../src/shared/index.js';

describe('FormulaEvaluator', () => {
    const caseRepository = new KnexCaseRepository(knexConfig);
    const clientRepository = new KnexClientRepository(caseRepository.connection);
    const auxCasesRepository = new KnexAuxCasesRepository(caseRepository.connection);
    const auxClientsRepository = new KnexAuxClientsRepository(caseRepository.connection);
    const service = new FormulaEvaluator(caseRepository, clientRepository, auxCasesRepository, auxClientsRepository);

    describe('execute()', () => {
        it('should throw error if updateModel is not an instance of ActionUpdateModel', async () => {
            const updateModel = {};
            const caso = Case.create(CasesMother.dto());

            await expect(service.execute(updateModel, caso)).rejects.toThrow(
                new InvalidArgumentError('The provided entity is not a valid instance of "ActionUpdateModel".')
            );
        });

        it('should throw error if caso is not an instance of Case', async () => {
            const updateModel = ActionUpdateModel.create(ActionUpdateModelMother.dto());
            const caso = {};

            await expect(service.execute(updateModel, caso)).rejects.toThrow(
                new InvalidArgumentError('The provided entity is not a valid instance of "Case".')
            );
        });

        it('should return current date in the format YYYY-MM-DD for fecha_actual formula', async () => {
            const dto = ActionUpdateModelMother.dto({
                formula: Formulas.FECHA_ACTUAL.value,
            });

            const updateModel = ActionUpdateModel.create(dto);
            const caso = Case.create(CasesMother.dto());

            const currentDate = dayjs().format('YYYY-MM-DD');
            const result = await service.execute(updateModel, caso);

            expect(result).toBe(currentDate);
        });

        it('should return current time in the format HH:mm:ss for hora_actual formula', async () => {
            const dto = ActionUpdateModelMother.dto({
                formula: Formulas.HORA_ACTUAL.value,
            });

            const updateModel = ActionUpdateModel.create(dto);
            const caso = Case.create(CasesMother.dto());

            const currentTime = dayjs().format('HH:mm:ss');
            const result = await service.execute(updateModel, caso);

            expect(result).toBe(currentTime);
        });

        it('should return current date and time as UTC ISO string for fecha_hora_actual formula', async () => {
            const dto = ActionUpdateModelMother.dto({
                formula: Formulas.FECHA_HORA_ACTUAL.value,
            });

            const updateModel = ActionUpdateModel.create(dto);
            const caso = Case.create(CasesMother.dto());

            const result = await service.execute(updateModel, caso);

            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        });

        it('should return true for boolean_true formula', async () => {
            const dto = ActionUpdateModelMother.dto({ formula: Formulas.BOOLEAN_TRUE.value });
            const updateModel = ActionUpdateModel.create(dto);
            const caso = Case.create(CasesMother.dto());

            const result = await service.execute(updateModel, caso);

            expect(result).toBe(true);
        });

        it('should return false for boolean_false formula', async () => {
            const dto = ActionUpdateModelMother.dto({ formula: Formulas.BOOLEAN_FALSE.value });
            const updateModel = ActionUpdateModel.create(dto);
            const caso = Case.create(CasesMother.dto());

            const result = await service.execute(updateModel, caso);

            expect(result).toBe(false);
        });

        it('should return a SHA-256 hash for the hashSha256 formula', async () => {
            const dto = ActionUpdateModelMother.dto({
                formula: Formulas.HASH_SHA256.value,
                field: 'motivo_baja',
            });

            const modelValue = 'some value';

            const updateModel = ActionUpdateModel.create(dto);
            const caso = Case.create(
                CasesMother.dto({
                    motivo_baja: modelValue,
                })
            );

            const result = await service.execute(updateModel, caso);

            expect(PasswordEncoder.compareHash(modelValue, result)).toBe(true);
        });

        it('should return the value from the Case model using modelo_a_modelo formula', async () => {
            const dto = ActionUpdateModelMother.dto({
                formula: Formulas.MODELO_A_MODELO.value,
                value: `${Aggregates.CASOS.value}.${CaseFields.MOTIVO_BAJA.value}`,
            });

            const modelValue = 'some value';

            const updateModel = ActionUpdateModel.create(dto);
            const caso = Case.create(
                CasesMother.dto({
                    motivo_baja: modelValue,
                })
            );

            const result = await service.execute(updateModel, caso);
            expect(result).toBe(modelValue);
        });

        it('should return the value from the Client model using modelo_a_modelo formula', async () => {
            const client = await ClientMother.createClient(clientRepository);

            const dto = ActionUpdateModelMother.dto({
                formula: Formulas.MODELO_A_MODELO.value,
                value: `${Aggregates.CLIENTES.value}.${CustomerFields.NOMBRES.value}`,
            });

            const updateModel = ActionUpdateModel.create(dto);
            const caso = Case.create(
                CasesMother.dto({
                    cliente_id: client.id.value,
                })
            );

            const result = await service.execute(updateModel, caso);
            expect(result).toBe(client.nombres.value);
        });

        it('should return the value from the AuxCase model using modelo_a_modelo formula', async () => {
            const dto = ActionUpdateModelMother.dto({
                formula: Formulas.MODELO_A_MODELO.value,
                value: `${Aggregates.AUX_CASE.value}.canal_contacto`,
            });

            const updateModel = ActionUpdateModel.create(dto);
            const caso = Case.create(CasesMother.dto());
            const auxCase = await AuxCasesMother.createAuxCase(auxCasesRepository, {
                caso_id: caso.id.value,
            });

            const result = await service.execute(updateModel, caso);
            expect(result).toBe(auxCase.data.value.canal_contacto);
        });

        it('should return the value from the AuxClient model using modelo_a_modelo formula', async () => {
            const dto = ActionUpdateModelMother.dto({
                formula: Formulas.MODELO_A_MODELO.value,
                value: `${Aggregates.AUX_CLIENT.value}.ciudad`,
            });

            const updateModel = ActionUpdateModel.create(dto);
            const caso = Case.create(CasesMother.dto());
            const auxClient = await AuxClientsMother.createAuxClient(auxClientsRepository, {
                cliente_id: caso.cliente_id.value,
            });

            const result = await service.execute(updateModel, caso);
            expect(result).toBe(auxClient.data.value.ciudad);
        });

        it('should reject with a wrapped error when the formula is not supported by any handler', async () => {
            // ValueObjectFormula only accepts the 7 known Formulas values, and `type` does not
            // constrain `formula`, so a "formula: undefined" ActionUpdateModel (legitimate for
            // a non-formula `type`) is the one way to reach #processFormula's `default` handler
            // through the public API. `ActionUpdateModelMother.dto()` itself applies `formula ??
            // Formulas.FECHA_ACTUAL.value`, so the override has to happen on its returned object
            // rather than through the mother's own `{ formula }` param.
            const dto = { ...ActionUpdateModelMother.dto({ type: 'alfanumerico' }), formula: undefined };
            const updateModel = ActionUpdateModel.create(dto);
            const caso = Case.create(CasesMother.dto());

            await expect(service.execute(updateModel, caso)).rejects.toThrow(
                `Error executing formula for case ${caso.id.value}`
            );
        });

        it('should return an empty string for modelo_a_modelo formula when value is not set', async () => {
            const dto = ActionUpdateModelMother.dto({
                formula: Formulas.MODELO_A_MODELO.value,
                value: null,
            });
            const updateModel = ActionUpdateModel.create(dto);
            const caso = Case.create(CasesMother.dto());

            const result = await service.execute(updateModel, caso);
            expect(result).toBe('');
        });

        it('should return an empty string for hashSha256 formula when the field value is falsy', async () => {
            const dto = ActionUpdateModelMother.dto({
                formula: Formulas.HASH_SHA256.value,
                field: CaseFields.FECHA_RESOLUCION.value,
            });
            const updateModel = ActionUpdateModel.create(dto);
            const caso = Case.create(CasesMother.dto({ fecha_resolucion: null }));

            const result = await service.execute(updateModel, caso);
            expect(result).toBe('');
        });

        it('should return an empty string via modelo_a_modelo when the Case field value is falsy', async () => {
            const dto = ActionUpdateModelMother.dto({
                formula: Formulas.MODELO_A_MODELO.value,
                value: `${Aggregates.CASOS.value}.${CaseFields.FECHA_RESOLUCION.value}`,
            });
            const updateModel = ActionUpdateModel.create(dto);
            const caso = Case.create(CasesMother.dto({ fecha_resolucion: null }));

            const result = await service.execute(updateModel, caso);
            expect(result).toBe('');
        });

        it('should return an empty string via modelo_a_modelo when the AuxCase field path does not exist', async () => {
            const dto = ActionUpdateModelMother.dto({
                formula: Formulas.MODELO_A_MODELO.value,
                value: `${Aggregates.AUX_CASE.value}.campo_inexistente`,
            });
            const updateModel = ActionUpdateModel.create(dto);
            const caso = Case.create(CasesMother.dto());
            await AuxCasesMother.createAuxCase(auxCasesRepository, { caso_id: caso.id.value });

            const result = await service.execute(updateModel, caso);
            expect(result).toBe('');
        });

        it('should reject with a wrapped error when modelName is unsupported in a case context', async () => {
            const dto = ActionUpdateModelMother.dto({
                formula: Formulas.MODELO_A_MODELO.value,
                value: 'UnsupportedModel.field',
            });
            const updateModel = ActionUpdateModel.create(dto);
            const caso = Case.create(CasesMother.dto());

            await expect(service.execute(updateModel, caso)).rejects.toThrow(
                `Error executing formula for case ${caso.id.value}`
            );
        });
    });

    describe('getModelValue()', () => {
        it('returns an empty string when model is not an object', () => {
            expect(service.getModelValue('not-an-object', 'field')).toBe('');
            expect(service.getModelValue(42, 'field')).toBe('');
        });

        it('returns an empty string when field is not a string', () => {
            expect(service.getModelValue({ field: { value: 'x' } }, 123)).toBe('');
        });
    });

    describe('executeForClient()', () => {
        it('should throw error if updateModel is not an instance of ActionUpdateModel', async () => {
            const updateModel = {};
            const client = ClientMother.getValidClient();

            await expect(service.executeForClient(updateModel, client)).rejects.toThrow(
                new InvalidArgumentError('The provided entity is not a valid instance of "ActionUpdateModel".')
            );
        });

        it('should throw error if client is not an instance of Client', async () => {
            const updateModel = ActionUpdateModel.create(ActionUpdateModelMother.dto());
            const client = {};

            await expect(service.executeForClient(updateModel, client)).rejects.toThrow(
                new InvalidArgumentError('The provided entity is not a valid instance of "Client".')
            );
        });

        it('should return current date in the format YYYY-MM-DD for fecha_actual formula', async () => {
            const dto = ActionUpdateModelMother.dto({ formula: Formulas.FECHA_ACTUAL.value });
            const updateModel = ActionUpdateModel.create(dto);
            const client = ClientMother.getValidClient();

            const currentDate = dayjs().format('YYYY-MM-DD');
            const result = await service.executeForClient(updateModel, client);

            expect(result).toBe(currentDate);
        });

        it('should return current time in the format HH:mm:ss for hora_actual formula', async () => {
            const dto = ActionUpdateModelMother.dto({ formula: Formulas.HORA_ACTUAL.value });
            const updateModel = ActionUpdateModel.create(dto);
            const client = ClientMother.getValidClient();

            const currentTime = dayjs().format('HH:mm:ss');
            const result = await service.executeForClient(updateModel, client);

            expect(result).toBe(currentTime);
        });

        it('should return current date and time as UTC ISO string for fecha_hora_actual formula', async () => {
            const dto = ActionUpdateModelMother.dto({ formula: Formulas.FECHA_HORA_ACTUAL.value });
            const updateModel = ActionUpdateModel.create(dto);
            const client = ClientMother.getValidClient();

            const result = await service.executeForClient(updateModel, client);

            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        });

        it('should return a SHA-256 hash for the hashSha256 formula using the Client model', async () => {
            const dto = ActionUpdateModelMother.dto({
                aggregate: Aggregates.CLIENTES.value,
                formula: Formulas.HASH_SHA256.value,
                field: CustomerFields.NOMBRES.value,
            });
            const updateModel = ActionUpdateModel.create(dto);
            const client = ClientMother.getValidClient();

            const result = await service.executeForClient(updateModel, client);

            expect(PasswordEncoder.compareHash(client.nombres.value, result)).toBe(true);
        });

        it('should return the value from the Client model using modelo_a_modelo formula', async () => {
            const client = ClientMother.getValidClient();
            const dto = ActionUpdateModelMother.dto({
                formula: Formulas.MODELO_A_MODELO.value,
                value: `${Aggregates.CLIENTES.value}.${CustomerFields.NOMBRES.value}`,
            });
            const updateModel = ActionUpdateModel.create(dto);

            const result = await service.executeForClient(updateModel, client);
            expect(result).toBe(client.nombres.value);
        });

        it('should return the value from the AuxClient model using modelo_a_modelo formula', async () => {
            const client = await ClientMother.createClient(clientRepository);
            const dto = ActionUpdateModelMother.dto({
                formula: Formulas.MODELO_A_MODELO.value,
                value: `${Aggregates.AUX_CLIENT.value}.ciudad`,
            });
            const updateModel = ActionUpdateModel.create(dto);
            const auxClient = await AuxClientsMother.createAuxClient(auxClientsRepository, {
                cliente_id: client.id.value,
            });

            const result = await service.executeForClient(updateModel, client);
            expect(result).toBe(auxClient.data.value.ciudad);
        });

        it('should reject with a wrapped error when modelName is unsupported in a client-only context', async () => {
            const client = ClientMother.getValidClient();
            const dto = ActionUpdateModelMother.dto({
                formula: Formulas.MODELO_A_MODELO.value,
                value: 'UnsupportedModel.field',
            });
            const updateModel = ActionUpdateModel.create(dto);

            await expect(service.executeForClient(updateModel, client)).rejects.toThrow(
                `Error executing formula for client ${client.id.value}`
            );
        });
    });
});

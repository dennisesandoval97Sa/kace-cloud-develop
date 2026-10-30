import { v4 as uuidv4 } from 'uuid';
import { InvalidArgumentError } from '../../../../src/shared/errors/InvalidArgumentError.js';
import { ValidationFailError } from '../../../../src/shared/errors/ValidationFailError.js';
import { KnexAuxCasesRepository } from '../../../../src/aux_casos/index.js';
import { KnexAuxClientsRepository } from '../../../../src/aux_clientes/index.js';
import { KnexGroupsRepository } from '../../../../src/grupos/index.js';
import { KnexGlobalConfigurationRepository } from '../../../../src/global-config/index.js';
import { KnexSubcaseRelationshipRepository } from '../../../../src/cases/index.js';
import { KnexShiftManagementRepository } from '../../../../src/shift-management/index.js';
import { KnexAnsRepository } from '../../../../src/ans';
import { KnexClassificationRepository } from '../../../../src/classifications';
import { GroupsMother } from '../../../grupos/domain/GroupsMother.js';
import { GlobalConfigurationsMother } from '../../../global-config/domain/GlobalConfigurationsMother.js';
import { Case, KnexCaseRepository } from '../../../../src/cases/index.js';
import { KnexClientRepository } from '../../../../src/clients/index.js';
import { knexConfig } from '../../../knexfile.js';
import { ModelValueSaver } from '../../../../src/actions/domain/ModelValueSaver.js';
import CasesMother from '../../../cases/domain/CasesMother.js';
import ClientMother from '../../../clients/domain/ClientMother.js';
import { AuxCasesMother } from '../../../aux_casos/domain/AuxCasesMother.js';
import { AuxClientsMother } from '../../../aux_clientes/domain/AuxClientsMother.js';
import dayjs from 'dayjs';
import { jest } from '@jest/globals';
import AnsMother from '../../../ans/domain/AnsMother.js';
import ClassificationsMother from '../../../classifications/domain/ClassificationsMother.js';

describe('ModelValueSaver', () => {
    const caseRepository = new KnexCaseRepository(knexConfig);
    const clientRepository = new KnexClientRepository(caseRepository.connection);
    const auxCasesRepository = new KnexAuxCasesRepository(caseRepository.connection);
    const auxClientsRepository = new KnexAuxClientsRepository(caseRepository.connection);
    const classificationRepository = new KnexClassificationRepository(caseRepository.connection);
    const ansRepository = new KnexAnsRepository(caseRepository.connection);
    const shiftRepository = new KnexShiftManagementRepository(caseRepository.connection);
    const groupsRepository = new KnexGroupsRepository(caseRepository.connection);
    const globalConfigurationRepository = new KnexGlobalConfigurationRepository(caseRepository.connection);
    const subcaseRelationshipRepository = new KnexSubcaseRelationshipRepository(caseRepository.connection);
    const service = new ModelValueSaver(
        caseRepository,
        clientRepository,
        auxCasesRepository,
        auxClientsRepository,
        groupsRepository,
        globalConfigurationRepository,
        subcaseRelationshipRepository
    );

    async function createValidGroup(allowClose = true) {
        const config = await GlobalConfigurationsMother.createWorkQueueAuxConfig(globalConfigurationRepository, {
            behaviors: { application: { agente: { casos: { allow_close_case_without_subcases: allowClose } } } },
        });
        const group = await GroupsMother.createGroup(groupsRepository, shiftRepository, {
            configuration_id: config.id.value,
        });
        return group;
    }

    describe('execute()', () => {
        it('should throw error if caso is not an instance of Case', async () => {
            const modelName = 'Case';
            const field = 'fecha_resolucion';
            const value = dayjs().format('YYYY-MM-DD');
            const caso = {};

            await expect(service.execute(modelName, field, value, caso)).rejects.toThrow(
                new InvalidArgumentError('The provided entity is not a valid instance of "Case".')
            );
        });

        it('should throw error if modelName is invalid', async () => {
            const modelName = 'InvalidModel';
            const field = 'fecha_resolucion';
            const value = dayjs().format('YYYY-MM-DD');
            const caso = Case.create(CasesMother.dto());

            await expect(service.execute(modelName, field, value, caso)).rejects.toThrow(
                new InvalidArgumentError('ModelValueSaver: Modelo no soportado')
            );
        });

        it('should save value to the Case model', async () => {
            const modelName = 'Case';
            const field = 'motivo_baja';
            const value = 'Test';
            const group = await createValidGroup();
            const caso = await CasesMother.createCase(caseRepository, { grupo_id: group.id.value });

            await service.execute(modelName, field, value, caso);

            const updatedCase = await caseRepository.find(caso.id);
            expect(updatedCase.motivo_baja.value).toBe(value);
        });

        it('should save value to the Client model', async () => {
            const modelName = 'Client';
            const field = 'nombres';
            const value = 'Nuevo Cliente';
            const client = await ClientMother.createClient(clientRepository);

            const caso = Case.create(
                CasesMother.dto({
                    cliente_id: client.id.value,
                })
            );

            await service.execute(modelName, field, value, caso);

            const updatedClient = await clientRepository.find(client.id);
            expect(updatedClient.nombres.value).toBe(value);
        });

        it('should save value to the AuxCase model', async () => {
            const modelName = 'AuxCases';
            const field = 'canal_contacto';
            const value = 'Telefono';
            const caso = await CasesMother.createCase(caseRepository);
            const auxCase = await AuxCasesMother.createAuxCase(auxCasesRepository, {
                caso_id: caso.id.value,
            });

            await service.execute(modelName, field, value, caso);

            const updatedAuxCase = await auxCasesRepository.find(auxCase.id);
            expect(updatedAuxCase.data.value.canal_contacto).toBe(value);
        });

        it('should save value to the AuxClient model', async () => {
            const modelName = 'AuxClient';
            const field = 'ciudad';
            const value = 'Madrid';
            const caso = await CasesMother.createCase(caseRepository);
            const auxClient = await AuxClientsMother.createAuxClient(auxClientsRepository, {
                cliente_id: caso.cliente_id.value,
            });

            await service.execute(modelName, field, value, caso);

            const updatedAuxClient = await auxClientsRepository.find(auxClient.id);
            expect(updatedAuxClient.data.value.ciudad).toBe(value);
        });

        it('should throw error if the case field is invalid', async () => {
            const modelName = 'Case';
            const field = 'invalid_field';
            const value = 'Invalid Value';
            const caso = await CasesMother.createCase(caseRepository);

            await expect(service.execute(modelName, field, value, caso)).rejects.toThrow(
                new InvalidArgumentError(`saveToCase: Field "${field}" does not exist on Case model`)
            );
        });

        it('should throw error if the client field is invalid', async () => {
            const modelName = 'Client';
            const field = 'invalid_field';
            const value = 'Invalid Value';
            const client = await ClientMother.createClient(clientRepository);
            const caso = await CasesMother.createCase(caseRepository, {
                cliente_id: client.id.value,
            });

            await expect(service.execute(modelName, field, value, caso)).rejects.toThrow(
                new InvalidArgumentError(`saveToClient: Field "${field}" does not exist on Client model`)
            );
        });

        it('should throw error if the Case value is not supported', async () => {
            const modelName = 'Case';
            const field = 'fecha_resolucion';
            const value = 'Invalid Value';
            const caso = await CasesMother.createCase(caseRepository);

            await expect(service.execute(modelName, field, value, caso)).rejects.toThrow();
        });

        it('should save value to a nested field within the AuxClient model', async () => {
            const modelName = 'AuxClient';
            const field = 'auxcli_campanya.ENERO_20250122.auxcli_ciiu';
            const value = '2268199';
            const caso = await CasesMother.createCase(caseRepository);

            const data = {
                auxcli_campanya: {
                    ENERO_20250122: {
                        auxcli_ciiu: 'Valor campo ciiu',
                        auxcli_tel1: [2268196, 573016254],
                    },
                },
            };
            const auxClient = await AuxClientsMother.createAuxClient(auxClientsRepository, {
                cliente_id: caso.cliente_id.value,
                data,
            });

            data.auxcli_campanya.ENERO_20250122.auxcli_ciiu = value;

            await service.execute(modelName, field, value, caso);

            const updatedAuxClient = await auxClientsRepository.find(auxClient.id);
            expect(updatedAuxClient.data.value).toEqual(data);
        });

        it('should save value to a nested array field within the AuxClient model', async () => {
            const modelName = 'AuxClient';
            const field = 'auxcli_campanya.ENERO_20250122[0].auxcli_ciiu';
            const value = 'Email';
            const caso = await CasesMother.createCase(caseRepository);

            const data = {
                auxcli_campanya: {
                    ENERO_20250122: [
                        {
                            auxcli_ciiu: 'Valor campo ciiu',
                            auxcli_tel1: [2268196, 573016254],
                        },
                    ],
                },
            };
            const auxClient = await AuxClientsMother.createAuxClient(auxClientsRepository, {
                cliente_id: caso.cliente_id.value,
                data,
            });

            const expected = JSON.parse(JSON.stringify(data));
            expected.auxcli_campanya.ENERO_20250122.push({
                auxcli_ciiu: value,
            });

            await service.execute(modelName, field, value, caso);

            const updatedAuxClient = await auxClientsRepository.find(auxClient.id);
            expect(updatedAuxClient.data.value).toEqual(expected);
        });

        it('should update only the targeted field without overwriting fresh DB updates in AuxCase due to caching', async () => {
            const caso = await CasesMother.createCase(caseRepository);
            const auxCase = await AuxCasesMother.createAuxCase(auxCasesRepository, {
                caso_id: caso.id.value,
                data: {
                    asistencia: {
                        campo_A: 'valor_original_A',
                        campo_B: 'valor_original_B',
                    },
                },
            });

            await auxCasesRepository.findByCaseId(caso.id);

            const newData = JSON.parse(JSON.stringify(auxCase.data.value));
            newData.asistencia.campo_B = 'nuevo_valor_B_externo';
            auxCase.update({ data: newData });
            await auxCasesRepository.update(auxCase);

            await service.execute('AuxCases', 'asistencia.campo_A', 'nuevo_valor_A', caso);

            const updated = await auxCasesRepository.find(auxCase.id);
            expect(updated.data.value.asistencia.campo_A).toBe('nuevo_valor_A');
            expect(updated.data.value.asistencia.campo_B).toBe('nuevo_valor_B_externo');
        });

        it('should recalculate ANS if fecha_resolucion is updated', async () => {
            const group = await createValidGroup();
            const caso = await CasesMother.createCase(caseRepository, { grupo_id: group.id.value });
            const spy = jest.spyOn(service.ansCalculator, 'execute').mockResolvedValue(undefined);

            await service.execute('Case', 'fecha_resolucion', dayjs().add(1, 'day').format('YYYY-MM-DD'), caso);

            expect(spy).toHaveBeenCalledWith(caso.id.value);
        });

        it('should recalculate ANS if state_change_at is updated', async () => {
            jest.clearAllMocks();
            const group = await createValidGroup();
            const caso = await CasesMother.createCase(caseRepository, { grupo_id: group.id.value });
            const spy = jest.spyOn(service.ansCalculator, 'execute').mockResolvedValue(undefined);

            await service.execute('Case', 'state_change_at', dayjs().toISOString(), caso);

            expect(spy).toHaveBeenCalledWith(caso.id.value);
        });

        it('should NOT recalculate ANS if a non-sensitive field is updated', async () => {
            jest.clearAllMocks();
            const group = await createValidGroup();
            const caso = await CasesMother.createCase(caseRepository, { grupo_id: group.id.value });
            const spy = jest.spyOn(service.ansCalculator, 'execute');

            await service.execute('Case', 'motivo_baja', 'No recalcular', caso);

            expect(spy).not.toHaveBeenCalled();
        });

        it('should reset update_source to null when updating transicion_id via automation (regression)', async () => {
            const group = await createValidGroup();
            const caso = await CasesMother.createCase(caseRepository, {
                grupo_id: group.id.value,
                update_source: 'manual',
            });

            expect(caso.update_source.value).toBe('manual');

            const newTransicionId = caso.transicion_id.value;
            await service.execute('Case', 'transicion_id', newTransicionId, caso);

            const updatedCase = await caseRepository.find(caso.id);
            expect(updatedCase.update_source.value).toBeNull();

            const historyRow = await caseRepository
                .connection('history_cases')
                .where({ entity_id: caso.id.value })
                .orderBy('created_at', 'desc')
                .first();
            const raw = historyRow.new_attributes;
            const newAttributes = typeof raw === 'string' ? JSON.parse(raw) : raw;
            expect(newAttributes.update_source).toBeNull();
        });

        it('should NOT reset update_source when updating a non-transition field via automation', async () => {
            const group = await createValidGroup();
            const caso = await CasesMother.createCase(caseRepository, {
                grupo_id: group.id.value,
                update_source: 'manual',
            });

            await service.execute('Case', 'motivo_baja', 'Some reason', caso);

            const updatedCase = await caseRepository.find(caso.id);
            expect(updatedCase.update_source.value).toBe('manual');
        });

        it('should throw InvalidArgumentError when closing with open subcases and config forbids it', async () => {
            const group = await createValidGroup(false);
            const { id: ansId } = await AnsMother.createAns(ansRepository);
            const { id: classificationId } = await ClassificationsMother.createClassification(
                classificationRepository,
                {
                    ans_id: ansId.value,
                }
            );
            const parent = await CasesMother.createCase(caseRepository, {
                grupo_id: group.id.value,
                clasificacion_id: classificationId.value,
            });
            const child = await CasesMother.createCase(caseRepository, {
                grupo_id: group.id.value,
                clasificacion_id: classificationId.value,
            });
            await subcaseRelationshipRepository.save({
                parent_case_id: parent.id,
                child_case_id: child.id,
            });
            await expect(service.execute('Case', 'fecha_resolucion', dayjs().toISOString(), parent)).rejects.toThrow(
                new InvalidArgumentError(
                    'The case cannot be closed: it has open subcases, and the group configuration prohibits it.'
                )
            );

            const reloaded = await caseRepository.find(parent.id);
            expect(reloaded.fecha_resolucion.value).toBeNull();
        });
    });

    describe('executeV2()', () => {
        it('should throw error if neither cliente_id nor caso_id is provided', async () => {
            await expect(service.executeV2({ modelName: 'Case', field: 'motivo_baja', value: 'x' })).rejects.toThrow(
                new InvalidArgumentError('Both cliente_id and caso_id must be provided.')
            );
        });

        it('should throw error if field is not a non-empty string', async () => {
            await expect(
                service.executeV2({ modelName: 'Case', field: '', value: 'x', caso_id: uuidv4() })
            ).rejects.toThrow(new InvalidArgumentError('Field must be a valid string and cannot be empty.'));

            await expect(
                service.executeV2({ modelName: 'Case', field: 42, value: 'x', caso_id: uuidv4() })
            ).rejects.toThrow(new InvalidArgumentError('Field must be a valid string and cannot be empty.'));
        });

        it('should throw error if modelName is not supported', async () => {
            await expect(
                service.executeV2({ modelName: 'InvalidModel', field: 'x', value: 'x', caso_id: uuidv4() })
            ).rejects.toThrow(new InvalidArgumentError('ModelValueSaver: Modelo no soportado'));
        });

        it('should save value to the Case model using caso_id', async () => {
            const value = 'Motivo por executeV2';
            const caso = await CasesMother.createCase(caseRepository);

            await service.executeV2({ modelName: 'Case', field: 'motivo_baja', value, caso_id: caso.id.value });

            const updatedCase = await caseRepository.find(caso.id);
            expect(updatedCase.motivo_baja.value).toBe(value);
        });

        it('should save value to the Client model using cliente_id', async () => {
            const value = 'Cliente por executeV2';
            const client = await ClientMother.createClient(clientRepository);

            await service.executeV2({ modelName: 'Client', field: 'nombres', value, cliente_id: client.id.value });

            const updatedClient = await clientRepository.find(client.id);
            expect(updatedClient.nombres.value).toBe(value);
        });

        it('should save value to the AuxCases model using caso_id', async () => {
            const value = 'Correo por executeV2';
            const caso = await CasesMother.createCase(caseRepository);
            const auxCase = await AuxCasesMother.createAuxCase(auxCasesRepository, { caso_id: caso.id.value });

            await service.executeV2({
                modelName: 'AuxCases',
                field: 'canal_contacto',
                value,
                caso_id: caso.id.value,
            });

            const updatedAuxCase = await auxCasesRepository.find(auxCase.id);
            expect(updatedAuxCase.data.value.canal_contacto).toBe(value);
        });

        it('should save value to the AuxClient model using cliente_id', async () => {
            const value = 'Bogota por executeV2';
            const client = await ClientMother.createClient(clientRepository);
            const auxClient = await AuxClientsMother.createAuxClient(auxClientsRepository, {
                cliente_id: client.id.value,
            });

            await service.executeV2({
                modelName: 'AuxClient',
                field: 'ciudad',
                value,
                cliente_id: client.id.value,
            });

            const updatedAuxClient = await auxClientsRepository.find(auxClient.id);
            expect(updatedAuxClient.data.value.ciudad).toBe(value);
        });
    });

    describe('not-found guards', () => {
        it('should throw when saving to a Case model whose caso_id does not exist', async () => {
            await expect(
                service.executeV2({ modelName: 'Case', field: 'motivo_baja', value: 'x', caso_id: uuidv4() })
            ).rejects.toThrow(new InvalidArgumentError('saveToCase: Invalid case or field'));
        });

        it('should throw when saving to a Client model whose cliente_id does not exist', async () => {
            await expect(
                service.executeV2({ modelName: 'Client', field: 'nombres', value: 'x', cliente_id: uuidv4() })
            ).rejects.toThrow(new InvalidArgumentError('saveToCase: Invalid client or field'));
        });

        it('should throw when saving to an AuxCases model whose case has no AuxCase row', async () => {
            const caso = await CasesMother.createCase(caseRepository);

            await expect(
                service.executeV2({
                    modelName: 'AuxCases',
                    field: 'canal_contacto',
                    value: 'x',
                    caso_id: caso.id.value,
                })
            ).rejects.toThrow(new InvalidArgumentError('saveToAuxCase: Invalid aux case or field'));
        });

        it('should throw when saving to an AuxClient model whose client has no AuxClient row', async () => {
            const client = await ClientMother.createClient(clientRepository);

            await expect(
                service.executeV2({
                    modelName: 'AuxClient',
                    field: 'ciudad',
                    value: 'x',
                    cliente_id: client.id.value,
                })
            ).rejects.toThrow(new InvalidArgumentError('saveToAuxClient: Invalid aux client or field'));
        });
    });

    describe('no-op guards', () => {
        it('should throw when the AuxCase field already has the requested value', async () => {
            const caso = await CasesMother.createCase(caseRepository);
            await AuxCasesMother.createAuxCase(auxCasesRepository, {
                caso_id: caso.id.value,
                data: { canal_contacto: 'Telefono' },
            });

            await expect(
                service.executeV2({
                    modelName: 'AuxCases',
                    field: 'canal_contacto',
                    value: 'Telefono',
                    caso_id: caso.id.value,
                })
            ).rejects.toThrow(new InvalidArgumentError('saveToAuxCase: No changes were applied'));
        });

        it('should throw when the AuxClient field already has the requested value', async () => {
            const client = await ClientMother.createClient(clientRepository);
            await AuxClientsMother.createAuxClient(auxClientsRepository, {
                cliente_id: client.id.value,
                data: { ciudad: 'Madrid' },
            });

            await expect(
                service.executeV2({
                    modelName: 'AuxClient',
                    field: 'ciudad',
                    value: 'Madrid',
                    cliente_id: client.id.value,
                })
            ).rejects.toThrow(new InvalidArgumentError('saveToAuxClient: No changes were applied'));
        });
    });

    describe('AgentCasesConfigFinder', () => {
        it('throws a domain error when closing a case whose group has no configuration_id', async () => {
            const group = await GroupsMother.createGroupWithRelations(groupsRepository, { configuration_id: null });
            const caso = await CasesMother.createCase(caseRepository, { grupo_id: group.id.value });

            await expect(
                service.execute('Case', 'fecha_resolucion', dayjs().format('YYYY-MM-DD'), caso)
            ).rejects.toThrow(new ValidationFailError('Group configuration_id is required', 'configuration_id'));
        });
    });
});

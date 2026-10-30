import { Action, KnexActionRepository } from '../../../../src/actions/index.js';
import { CaseActionValidator } from '../../../../src/shared/domain/services/CaseActionValidator';
import ActionMother from '../../../actions/domain/ActionMother.js';
import CasesMother from '../../../cases/domain/CasesMother.js';
import ClientMother from '../../../clients/domain/ClientMother.js';
import { AuxCasesMother } from '../../../aux_casos/domain/AuxCasesMother.js';
import { AuxClientsMother } from '../../../aux_clientes/domain/AuxClientsMother.js';
import { knexConfig } from '../../../knexfile.js';
import ClassificationsMother from '../../../classifications/domain/ClassificationsMother.js';
import { jest } from '@jest/globals';
import { RuleOperator } from '../../../../src/actions/domain/QueryTranslator/RuleOperator.js';
import { Case } from '../../../../src/cases';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';

describe('CaseActionValidator', () => {
    const actionRepository = new KnexActionRepository(knexConfig);
    const validator = new CaseActionValidator(actionRepository);
    const fakeCase = {
        cases: CasesMother.dto(),
        clients: ClientMother.dto(),
        aux_cases: AuxCasesMother.dto().data,
        aux_clients: { ...AuxClientsMother.dto().data, cliente: ClientMother.dto() },
        clasificaciones: ClassificationsMother.dto(),
        estados: {
            id: 5,
            nombre: 'En revisión',
        },
    };

    jest.spyOn(actionRepository, 'getCasoInfo').mockImplementation(async () => fakeCase);

    it('should correctly validate simple value-type rules', async () => {
        const conditions = {
            combinator: 'and',
            rules: [
                {
                    field: 'clients.nombres',
                    operator: RuleOperator.CONTAINS,
                    value: fakeCase.clients.nombres,
                    type: 'manual_input',
                },
                {
                    field: 'clients.apellido1',
                    operator: RuleOperator.EQUALS,
                    value: fakeCase.clients.apellido1,
                    type: 'manual_input',
                },
            ],
        };

        const action = new Action(ActionMother.dto({ conditions }));
        const isValid = await validator.validate(new Case(CasesMother.dto()), action);

        expect(isValid).toBe(true);
    });

    it('should return false if an entity field does not match the case value', async () => {
        const conditions = {
            combinator: 'and',
            rules: [
                {
                    field: 'clients.nombres',
                    operator: RuleOperator.NOT_EQUALS,
                    value: 'aux_clients.cliente.nombres',
                    type: 'entity',
                },
            ],
        };

        const action = new Action(ActionMother.dto({ conditions }));
        const isValid = await validator.validate(new Case(CasesMother.dto()), action);

        expect(isValid).toBe(false);
    });

    it('should return false if the referenced entity path does not exist', async () => {
        const conditions = {
            combinator: 'and',
            rules: [
                {
                    field: 'clients.nombres',
                    operator: RuleOperator.EQUALS,
                    value: 'aux_clients.cliente.nonExistentField',
                    type: 'entity',
                },
            ],
        };

        const action = new Action(ActionMother.dto({ conditions }));
        const isValid = await validator.validate(new Case(CasesMother.dto()), action);

        expect(isValid).toBe(false);
    });

    it('should validate deeply nested conditions with multiple combinators', async () => {
        const conditions = {
            combinator: 'and',
            rules: [
                {
                    field: 'clients.nombres',
                    operator: RuleOperator.CONTAINS,
                    value: fakeCase.clients.nombres,
                    type: 'manual_input',
                },
                {
                    combinator: 'or',
                    rules: [
                        {
                            field: 'clients.apellido1',
                            operator: RuleOperator.EQUALS,
                            value: 'aux_clients.cliente.apellido1',
                            type: 'entity',
                        },
                        {
                            combinator: 'and',
                            rules: [
                                {
                                    field: 'clients.apellido2',
                                    operator: RuleOperator.EQUALS,
                                    value: 'aux_clients.cliente.apellido2',
                                    type: 'entity',
                                },
                                {
                                    field: 'clients.nombres',
                                    operator: RuleOperator.NOT_EQUALS,
                                    value: 'Pedro',
                                    type: 'manual_input',
                                },
                            ],
                        },
                    ],
                },
            ],
        };

        const action = new Action(ActionMother.dto({ conditions }));
        const isValid = await validator.validate(new Case(CasesMother.dto()), action);

        expect(isValid).toBe(true);
    });

    it('should return false if all OR conditions are false', async () => {
        const conditions = {
            combinator: 'or',
            rules: [
                {
                    field: 'clients.nombres',
                    operator: RuleOperator.EQUALS,
                    value: 'Pedro',
                    type: 'manual_input',
                },
                {
                    field: 'clients.apellido1',
                    operator: RuleOperator.CONTAINS,
                    value: 'Ramírez',
                    type: 'manual_input',
                },
            ],
        };

        const action = new Action(ActionMother.dto({ conditions }));
        const isValid = await validator.validate(new Case(CasesMother.dto()), action);

        expect(isValid).toBe(false);
    });

    describe('asignar_grupo_por_codigo_externo — aux_cases autocalculado date vs FECHA_HORA function', () => {
        const ESTADO_A_ID = '444089ae-9a0b-41de-a6ee-542412b0d654';
        const ESTADO_B_ID = '685a54fe-a810-4b1b-b90b-e216227dd856';
        const RESPONSABLE_ID = '3043d131-f5ff-4dd0-b7f2-eb4951f1ff9b';

        const conditions = {
            id: '8214bc52-7b3a-4741-9e4b-6c15a1c65e9a',
            combinator: 'and',
            rules: [
                {
                    id: '9184c278-0a7b-4825-a7f0-b93aebb78d3d',
                    not: false,
                    combinator: 'and',
                    rules: [
                        {
                            id: '6740ca84-8133-4639-8487-6ef997cb8ea1',
                            not: false,
                            combinator: 'and',
                            rules: [
                                {
                                    id: '98b90f60-6733-4892-ab36-9f2dc9217246',
                                    type: 'options_list',
                                    field: 'clasificaciones.nivel1',
                                    value: 'Reclamaciones',
                                    operator: '=',
                                    value_type: 'text',
                                },
                            ],
                        },
                        {
                            id: 'aceebae4-e0ee-4cca-83e7-6dfee51898da',
                            not: false,
                            combinator: 'or',
                            rules: [
                                {
                                    id: '8f6abd7e-5cd4-420c-b76a-03cb31d53b88',
                                    type: 'options_list',
                                    field: 'cases.estadoActual',
                                    value: ESTADO_A_ID,
                                    operator: '=',
                                    value_type: 'text',
                                    valueSource: 'value',
                                },
                                {
                                    id: 'b0f06b31-55e1-4eca-a783-747223994621',
                                    not: false,
                                    combinator: 'and',
                                    rules: [
                                        {
                                            id: '2a474347-7289-44af-aa43-43241bde98f2',
                                            type: 'options_list',
                                            field: 'cases.estadoActual',
                                            value: ESTADO_B_ID,
                                            operator: '=',
                                            value_type: 'text',
                                            valueSource: 'value',
                                        },
                                        {
                                            id: '63f3582d-71e7-4a9a-b46a-283f1cebcf02',
                                            type: 'function',
                                            field: 'aux_cases.reclamaciones.gestion_reclamacion.fecha_y_hora_de_reprogramacion',
                                            value: 'datetime',
                                            operator: '<',
                                            value_type: 'date',
                                            valueSource: 'value',
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            id: '7cbe014a-60b9-4c95-9fd4-c00c39967335',
                            not: false,
                            combinator: 'and',
                            rules: [
                                {
                                    id: '2585b0e9-98fa-4c6c-a13c-c8277e5fb5b7',
                                    type: 'options_list',
                                    field: 'cases.responsable_id',
                                    value: RESPONSABLE_ID,
                                    operator: '=',
                                    value_type: 'text',
                                    valueSource: 'value',
                                },
                            ],
                        },
                    ],
                },
            ],
        };

        const baseContext = {
            cases: CasesMother.dto({ responsable_id: RESPONSABLE_ID }),
            clients: ClientMother.dto(),
            aux_clients: { ...AuxClientsMother.dto().data, cliente: ClientMother.dto() },
            clasificaciones: ClassificationsMother.dto({ nivel1: 'Reclamaciones' }),
        };

        const makeAction = () =>
            new Action(
                ActionMother.dto({
                    action_type: 'asignar_grupo_por_codigo_externo',
                    conditions,
                    external_group_code: 'estado_reclamacion',
                    entity: 'case',
                })
            );

        it('Test E: Estado B + fecha pasada → true (action should execute)', async () => {
            const pastDate = dayjs().subtract(1, 'hour').toISOString();
            jest.spyOn(actionRepository, 'getCasoInfo').mockImplementationOnce(async () => ({
                ...baseContext,
                estados: { id: ESTADO_B_ID, nombre: 'Estado B' },
                aux_cases: {
                    reclamaciones: {
                        gestion_reclamacion: {
                            fecha_y_hora_de_reprogramacion: pastDate,
                        },
                    },
                },
            }));

            const isValid = await validator.validate(new Case(CasesMother.dto()), makeAction());
            expect(isValid).toBe(true);
        });

        it('Test F: Estado B + fecha futura → false (action must NOT execute)', async () => {
            const futureDate = dayjs().add(1, 'day').toISOString();
            jest.spyOn(actionRepository, 'getCasoInfo').mockImplementationOnce(async () => ({
                ...baseContext,
                estados: { id: ESTADO_B_ID, nombre: 'Estado B' },
                aux_cases: {
                    reclamaciones: {
                        gestion_reclamacion: {
                            fecha_y_hora_de_reprogramacion: futureDate,
                        },
                    },
                },
            }));

            const isValid = await validator.validate(new Case(CasesMother.dto()), makeAction());
            expect(isValid).toBe(false);
        });

        it('Test G: Estado A activo → true regardless of aux_cases date', async () => {
            jest.spyOn(actionRepository, 'getCasoInfo').mockImplementationOnce(async () => ({
                ...baseContext,
                estados: { id: ESTADO_A_ID, nombre: 'Estado A' },
                // aux_cases date is future — but Estado A satisfies the OR branch
                aux_cases: {
                    reclamaciones: {
                        gestion_reclamacion: {
                            fecha_y_hora_de_reprogramacion: dayjs().add(10, 'day').toISOString(),
                        },
                    },
                },
            }));

            const isValid = await validator.validate(new Case(CasesMother.dto()), makeAction());
            expect(isValid).toBe(true);
        });

        it('Test H: aux_cases field absent (autocalculado not stored) → false', async () => {
            jest.spyOn(actionRepository, 'getCasoInfo').mockImplementationOnce(async () => ({
                ...baseContext,
                estados: { id: ESTADO_B_ID, nombre: 'Estado B' },
                aux_cases: {},
            }));

            const isValid = await validator.validate(new Case(CasesMother.dto()), makeAction());
            expect(isValid).toBe(false);
        });
    });

    describe('asignar_lista_asesores — aux_cases autocalculado date vs FECHA_HORA function', () => {
        const ESTADO_A_ID = '444089ae-9a0b-41de-a6ee-542412b0d654';
        const ESTADO_B_ID = '685a54fe-a810-4b1b-b90b-e216227dd856';
        const RESPONSABLE_ID = '3043d131-f5ff-4dd0-b7f2-eb4951f1ff9b';
        const ADVISOR_LIST_ID = uuidv4();

        const conditions = {
            id: '8214bc52-7b3a-4741-9e4b-6c15a1c65e9a',
            combinator: 'and',
            rules: [
                {
                    id: '9184c278-0a7b-4825-a7f0-b93aebb78d3d',
                    not: false,
                    combinator: 'and',
                    rules: [
                        {
                            id: '6740ca84-8133-4639-8487-6ef997cb8ea1',
                            not: false,
                            combinator: 'and',
                            rules: [
                                {
                                    id: '98b90f60-6733-4892-ab36-9f2dc9217246',
                                    type: 'options_list',
                                    field: 'clasificaciones.nivel1',
                                    value: 'Reclamaciones',
                                    operator: '=',
                                    value_type: 'text',
                                },
                            ],
                        },
                        {
                            id: 'aceebae4-e0ee-4cca-83e7-6dfee51898da',
                            not: false,
                            combinator: 'or',
                            rules: [
                                {
                                    id: '8f6abd7e-5cd4-420c-b76a-03cb31d53b88',
                                    type: 'options_list',
                                    field: 'cases.estadoActual',
                                    value: ESTADO_A_ID,
                                    operator: '=',
                                    value_type: 'text',
                                    valueSource: 'value',
                                },
                                {
                                    id: 'b0f06b31-55e1-4eca-a783-747223994621',
                                    not: false,
                                    combinator: 'and',
                                    rules: [
                                        {
                                            id: '2a474347-7289-44af-aa43-43241bde98f2',
                                            type: 'options_list',
                                            field: 'cases.estadoActual',
                                            value: ESTADO_B_ID,
                                            operator: '=',
                                            value_type: 'text',
                                            valueSource: 'value',
                                        },
                                        {
                                            id: '63f3582d-71e7-4a9a-b46a-283f1cebcf02',
                                            type: 'function',
                                            field: 'aux_cases.reclamaciones.gestion_reclamacion.fecha_y_hora_de_reprogramacion',
                                            value: 'datetime',
                                            operator: '<',
                                            value_type: 'date',
                                            valueSource: 'value',
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            id: '7cbe014a-60b9-4c95-9fd4-c00c39967335',
                            not: false,
                            combinator: 'and',
                            rules: [
                                {
                                    id: '2585b0e9-98fa-4c6c-a13c-c8277e5fb5b7',
                                    type: 'options_list',
                                    field: 'cases.responsable_id',
                                    value: RESPONSABLE_ID,
                                    operator: '=',
                                    value_type: 'text',
                                    valueSource: 'value',
                                },
                            ],
                        },
                    ],
                },
            ],
        };

        const baseContext = {
            cases: CasesMother.dto({ responsable_id: RESPONSABLE_ID }),
            clients: ClientMother.dto(),
            aux_clients: { ...AuxClientsMother.dto().data, cliente: ClientMother.dto() },
            clasificaciones: ClassificationsMother.dto({ nivel1: 'Reclamaciones' }),
        };

        const makeAction = () =>
            new Action(
                ActionMother.dto({
                    action_type: 'asignar_lista_asesores',
                    conditions,
                    advisor_list_id: ADVISOR_LIST_ID,
                    entity: 'case',
                })
            );

        it('Test E: Estado B + fecha pasada → true (action should execute)', async () => {
            const pastDate = dayjs().subtract(1, 'hour').toISOString();
            jest.spyOn(actionRepository, 'getCasoInfo').mockImplementationOnce(async () => ({
                ...baseContext,
                estados: { id: ESTADO_B_ID, nombre: 'Estado B' },
                aux_cases: {
                    reclamaciones: {
                        gestion_reclamacion: {
                            fecha_y_hora_de_reprogramacion: pastDate,
                        },
                    },
                },
            }));

            const isValid = await validator.validate(new Case(CasesMother.dto()), makeAction());
            expect(isValid).toBe(true);
        });

        it('Test F: Estado B + fecha futura → false (action must NOT execute)', async () => {
            const futureDate = dayjs().add(1, 'day').toISOString();
            jest.spyOn(actionRepository, 'getCasoInfo').mockImplementationOnce(async () => ({
                ...baseContext,
                estados: { id: ESTADO_B_ID, nombre: 'Estado B' },
                aux_cases: {
                    reclamaciones: {
                        gestion_reclamacion: {
                            fecha_y_hora_de_reprogramacion: futureDate,
                        },
                    },
                },
            }));

            const isValid = await validator.validate(new Case(CasesMother.dto()), makeAction());
            expect(isValid).toBe(false);
        });

        it('Test G: Estado A activo → true regardless of aux_cases date', async () => {
            jest.spyOn(actionRepository, 'getCasoInfo').mockImplementationOnce(async () => ({
                ...baseContext,
                estados: { id: ESTADO_A_ID, nombre: 'Estado A' },
                aux_cases: {
                    reclamaciones: {
                        gestion_reclamacion: {
                            fecha_y_hora_de_reprogramacion: dayjs().add(10, 'day').toISOString(),
                        },
                    },
                },
            }));

            const isValid = await validator.validate(new Case(CasesMother.dto()), makeAction());
            expect(isValid).toBe(true);
        });

        it('Test H: aux_cases field absent (autocalculado not stored) → false', async () => {
            jest.spyOn(actionRepository, 'getCasoInfo').mockImplementationOnce(async () => ({
                ...baseContext,
                estados: { id: ESTADO_B_ID, nombre: 'Estado B' },
                aux_cases: {},
            }));

            const isValid = await validator.validate(new Case(CasesMother.dto()), makeAction());
            expect(isValid).toBe(false);
        });
    });

    it('should correctly validate entity-type rules', async () => {
        const conditions = {
            combinator: 'and',
            rules: [
                {
                    field: 'clients.nombres',
                    operator: RuleOperator.EQUALS,
                    value: 'aux_clients.cliente.nombres',
                    type: 'entity',
                },
                {
                    combinator: 'or',
                    rules: [
                        {
                            field: 'clients.apellido1',
                            operator: RuleOperator.CONTAINS,
                            value: 'Pérez',
                            type: 'manual_input',
                        },
                        {
                            field: 'clients.apellido2',
                            operator: RuleOperator.EQUALS,
                            value: 'aux_clients.cliente.apellido2',
                            type: 'entity',
                        },
                    ],
                },
            ],
        };

        const action = new Action(ActionMother.dto({ conditions }));
        const isValid = await validator.validate(new Case(CasesMother.dto()), action);

        expect(isValid).toBe(true);
    });
});

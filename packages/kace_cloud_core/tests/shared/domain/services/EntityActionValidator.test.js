import { EntityActionValidator } from '../../../../src/shared/domain/services/EntityActionValidator.js';
import { Action, KnexActionRepository } from '../../../../src/actions/index.js';
import { KnexUsersRepository } from '../../../../src/users/index.js';
import { KnexGroupsRepository } from '../../../../src/grupos/index.js';
import ActionMother from '../../../actions/domain/ActionMother.js';
import UsersMother from '../../../users/domain/UsersMother.js';
import { GroupsMother } from '../../../grupos/domain/GroupsMother.js';
import { KnexShiftManagementRepository } from '../../../../src/shift-management/index.js';
import { knexConfig } from '../../../knexfile.js';
import { RuleOperator } from '../../../../src/actions/domain/QueryTranslator/RuleOperator.js';

describe('EntityActionValidator', () => {
    const actionRepository = new KnexActionRepository(knexConfig);
    const usersRepository = new KnexUsersRepository(knexConfig);
    const groupsRepository = new KnexGroupsRepository(knexConfig);
    const shiftManagementRepository = new KnexShiftManagementRepository(knexConfig);
    const validator = new EntityActionValidator();

    describe('validate with User entity', () => {
        it('should return true when user meets simple condition', async () => {
            const user = await UsersMother.createUser(usersRepository, {
                nombres: 'John',
            });

            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'nombres',
                        operator: RuleOperator.EQUALS,
                        value: 'John',
                        type: 'manual_input',
                    },
                ],
            };

            const action = new Action(ActionMother.dto({ conditions }));

            const result = await validator.validate(user, action);

            expect(result).toBe(true);
        });

        it('should return false when user does not meet condition', async () => {
            const user = await UsersMother.createUser(usersRepository, {
                nombres: 'Jane',
            });

            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'nombres',
                        operator: RuleOperator.EQUALS,
                        value: 'John',
                        type: 'manual_input',
                    },
                ],
            };

            const action = new Action(ActionMother.dto({ conditions }));

            const result = await validator.validate(user, action);

            expect(result).toBe(false);
        });

        it('should validate complex AND conditions on user', async () => {
            const user = await UsersMother.createUser(usersRepository, {
                nombres: 'John',
                apellido1: 'Doe',
            });

            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'nombres',
                        operator: RuleOperator.EQUALS,
                        value: 'John',
                        type: 'manual_input',
                    },
                    {
                        field: 'apellido1',
                        operator: RuleOperator.EQUALS,
                        value: 'Doe',
                        type: 'manual_input',
                    },
                ],
            };

            const action = new Action(ActionMother.dto({ conditions }));

            const result = await validator.validate(user, action);

            expect(result).toBe(true);
        });

        it('should validate OR conditions on user', async () => {
            const user = await UsersMother.createUser(usersRepository, {
                nombres: 'John',
            });

            const conditions = {
                combinator: 'or',
                rules: [
                    {
                        field: 'nombres',
                        operator: RuleOperator.EQUALS,
                        value: 'Jane',
                        type: 'manual_input',
                    },
                    {
                        field: 'apellido1',
                        operator: RuleOperator.EQUALS,
                        value: 'Doe',
                        type: 'manual_input',
                    },
                ],
            };

            const action = new Action(ActionMother.dto({ conditions }));

            const result = await validator.validate(user, action);

            expect(result).toBe(true);
        });

        it('should handle empty conditions as true', async () => {
            const user = await UsersMother.createUser(usersRepository);

            const conditions = {
                combinator: 'and',
                rules: [],
            };

            const action = new Action(ActionMother.dto({ conditions }));

            const result = await validator.validate(user, action);

            expect(result).toBe(true);
        });

        it('should validate CONTAINS operator', async () => {
            const user = await UsersMother.createUser(usersRepository, {
                email: 'john.doe@example.com',
            });

            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'email',
                        operator: RuleOperator.CONTAINS,
                        value: 'john.doe',
                        type: 'manual_input',
                    },
                ],
            };

            const action = new Action(ActionMother.dto({ conditions }));

            const result = await validator.validate(user, action);

            expect(result).toBe(true);
        });

        it('should validate NOT_EQUALS operator', async () => {
            const user = await UsersMother.createUser(usersRepository, {
                nombres: 'John',
            });

            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'nombres',
                        operator: RuleOperator.NOT_EQUALS,
                        value: 'Jane',
                        type: 'manual_input',
                    },
                ],
            };

            const action = new Action(ActionMother.dto({ conditions }));

            const result = await validator.validate(user, action);

            expect(result).toBe(true);
        });

        it('should fall back to default active_session_limit of 2 minutes when no resolver is provided', async () => {
            const recentDate = new Date(Date.now() - 1 * 60 * 1000).toISOString();
            const user = await UsersMother.createUser(usersRepository, {
                last_seen_at: recentDate,
            });

            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'last_seen_at',
                        operator: RuleOperator.EQUALS,
                        value: 'true',
                        type: 'manual_input',
                    },
                ],
            };

            const action = new Action(ActionMother.dto({ conditions }));
            const result = await validator.validate(user, action);

            expect(result).toBe(true);
        });

        it('should treat null last_seen_at as inactive regardless of active_session_limit', async () => {
            const user = await UsersMother.createUser(usersRepository, {
                last_seen_at: null,
            });

            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'last_seen_at',
                        operator: RuleOperator.EQUALS,
                        value: 'false',
                        type: 'manual_input',
                    },
                ],
            };

            const action = new Action(ActionMother.dto({ conditions }));
            const result = await validator.validate(user, action);

            expect(result).toBe(true);
        });

        it('should use active_session_limit from configuration when resolver is provided', async () => {
            const recentDate = new Date(Date.now() - 3 * 60 * 1000).toISOString();
            const user = await UsersMother.createUser(usersRepository, {
                last_seen_at: recentDate,
            });

            const mockResolver = {
                resolve: async (entity) => entity.toRulesContext(2),
            };

            const validatorWithResolver = new EntityActionValidator(mockResolver);

            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'last_seen_at',
                        operator: RuleOperator.EQUALS,
                        value: 'false',
                        type: 'manual_input',
                    },
                ],
            };

            const action = new Action(ActionMother.dto({ conditions }));
            const result = await validatorWithResolver.validate(user, action);

            expect(result).toBe(true);
        });

        it('should consider user active when last_seen_at is within custom active_session_limit', async () => {
            const recentDate = new Date(Date.now() - 3 * 60 * 1000).toISOString();
            const user = await UsersMother.createUser(usersRepository, {
                last_seen_at: recentDate,
            });

            const mockResolver = {
                resolve: async (entity) => entity.toRulesContext(10),
            };

            const validatorWithResolver = new EntityActionValidator(mockResolver);

            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'last_seen_at',
                        operator: RuleOperator.EQUALS,
                        value: 'true',
                        type: 'manual_input',
                    },
                ],
            };

            const action = new Action(ActionMother.dto({ conditions }));
            const result = await validatorWithResolver.validate(user, action);

            expect(result).toBe(true);
        });

        it('should match aux_users.<field> when data contains the field', async () => {
            const user = await UsersMother.createUser(usersRepository, {
                data: { id_de_genesys_cloud: 'prueba' },
            });

            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'aux_users.id_de_genesys_cloud',
                        operator: RuleOperator.EQUALS,
                        value: 'prueba',
                        type: 'manual_input',
                    },
                ],
            };

            const action = new Action(ActionMother.dto({ conditions }));
            const result = await validator.validate(user, action);

            expect(result).toBe(true);
        });

        it('should not match aux_users.<field> when value differs', async () => {
            const user = await UsersMother.createUser(usersRepository, {
                data: { id_de_genesys_cloud: 'prueba' },
            });

            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'aux_users.id_de_genesys_cloud',
                        operator: RuleOperator.EQUALS,
                        value: 'otro',
                        type: 'manual_input',
                    },
                ],
            };

            const action = new Action(ActionMother.dto({ conditions }));
            const result = await validator.validate(user, action);

            expect(result).toBe(false);
        });

        it('should return false for aux_users.<field> when data is null', async () => {
            const user = await UsersMother.createUser(usersRepository, {
                data: null,
            });

            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'aux_users.foo',
                        operator: RuleOperator.EQUALS,
                        value: 'x',
                        type: 'manual_input',
                    },
                ],
            };

            const action = new Action(ActionMother.dto({ conditions }));
            const result = await validator.validate(user, action);

            expect(result).toBe(false);
        });

        it('should not fallback to top-level id when aux_users.id is missing in data', async () => {
            const user = await UsersMother.createUser(usersRepository, {
                data: { otro_campo: 'valor' },
            });

            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'aux_users.id',
                        operator: RuleOperator.EQUALS,
                        value: user.id.value,
                        type: 'manual_input',
                    },
                ],
            };

            const action = new Action(ActionMother.dto({ conditions }));
            const result = await validator.validate(user, action);

            expect(result).toBe(false);
        });

        it('should validate combined condition with usuarios.* and aux_users.* fields', async () => {
            const recentDate = new Date(Date.now() - 1 * 60 * 1000).toISOString();
            const user = await UsersMother.createUser(usersRepository, {
                is_active: 1,
                last_seen_at: recentDate,
                data: { id_de_genesys_cloud: 'prueba' },
            });

            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'usuarios.last_seen_at',
                        operator: RuleOperator.EQUALS,
                        value: 'true',
                        type: 'manual_input',
                    },
                    {
                        field: 'usuarios.is_active',
                        operator: RuleOperator.EQUALS,
                        value: '1',
                        type: 'manual_input',
                        value_type: 'number',
                    },
                    {
                        field: 'aux_users.id_de_genesys_cloud',
                        operator: RuleOperator.EQUALS,
                        value: 'prueba',
                        type: 'manual_input',
                    },
                ],
            };

            const action = new Action(ActionMother.dto({ conditions }));
            const result = await validator.validate(user, action);

            expect(result).toBe(true);
        });
    });

    describe('validate with Group entity', () => {
        it('should return true when group meets condition', async () => {
            const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'nombre',
                        operator: RuleOperator.CONTAINS,
                        value: 'Grupo de prueba',
                        type: 'manual_input',
                    },
                ],
            };

            const action = new Action(ActionMother.dto({ conditions }));

            const result = await validator.validate(group, action);

            expect(result).toBe(true);
        });

        it('should validate complex nested conditions on group', async () => {
            const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'nombre',
                        operator: RuleOperator.CONTAINS,
                        value: 'Grupo',
                        type: 'manual_input',
                    },
                    {
                        combinator: 'or',
                        rules: [
                            {
                                field: 'nombre',
                                operator: RuleOperator.CONTAINS,
                                value: 'prueba',
                                type: 'manual_input',
                            },
                            {
                                field: 'nombre',
                                operator: RuleOperator.CONTAINS,
                                value: 'test',
                                type: 'manual_input',
                            },
                        ],
                    },
                ],
            };

            const action = new Action(ActionMother.dto({ conditions }));

            const result = await validator.validate(group, action);

            expect(result).toBe(true);
        });
    });
});

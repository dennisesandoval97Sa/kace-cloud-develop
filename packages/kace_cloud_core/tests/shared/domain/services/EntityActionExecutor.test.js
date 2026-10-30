import { EntityActionExecutor } from '../../../../src/shared/domain/services/EntityActionExecutor.js';
import { Action, KnexActionRepository, ActionTypes } from '../../../../src/actions/index.js';
import { KnexUsersRepository } from '../../../../src/users/index.js';
import { KnexGroupsRepository } from '../../../../src/grupos/index.js';
import { KnexClientRepository } from '../../../../src/clients/index.js';
import { KnexTemplatesRepository } from '../../../../src/templates/index.js';
import { KnexMailAccountRepository } from '../../../../src/mail-accounts/index.js';
import { KnexWSRestFlowRepository } from '../../../../src/ws-rest-flows/index.js';
import { KnexWSRestWorkflowStepRepository } from '../../../../src/ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository.js';
import { KnexSecretsVaultRepository } from '../../../../src/secrets-vault/infrastructure/persistence/KnexSecretsVaultRepository.js';
import { KnexAllowedConnectionsRepository } from '../../../../src/allowed-conections/index.js';
import { KnexShiftManagementRepository } from '../../../../src/shift-management/index.js';
import ActionMother from '../../../actions/domain/ActionMother.js';
import UsersMother from '../../../users/domain/UsersMother.js';
import { knexConfig } from '../../../knexfile.js';
import { SendEmail } from '../../../../src/actions/domain/types/SendEmail.js';
import { CallWsService } from '../../../../src/actions/domain/types/CallWsService.js';

describe('EntityActionExecutor', () => {
    const actionRepository = new KnexActionRepository(knexConfig);
    const usersRepository = new KnexUsersRepository(knexConfig);
    const groupsRepository = new KnexGroupsRepository(knexConfig);
    const clientRepository = new KnexClientRepository(knexConfig);
    const templatesRepository = new KnexTemplatesRepository(knexConfig);
    const mailAccountRepository = new KnexMailAccountRepository(knexConfig);
    const wsRestFlowRepository = new KnexWSRestFlowRepository(knexConfig);
    const wsRestWorkflowStepRepository = new KnexWSRestWorkflowStepRepository(knexConfig);
    const secretRepository = new KnexSecretsVaultRepository(knexConfig);
    const allowedConnectionRepository = new KnexAllowedConnectionsRepository(knexConfig);

    let executor;
    let originalSendEmailExecute;
    let originalCallWsExecute;

    beforeEach(async () => {
        executor = new EntityActionExecutor({
            userRepository: usersRepository,
            groupRepository: groupsRepository,
            clientRepository,
            templatesRepository,
            mailAccountRepository,
            wsRestFlowRepository,
            wsRestWorkflowStepRepository,
            secretRepository,
            allowedConnectionRepository,
        });

        originalSendEmailExecute = SendEmail.prototype.execute;
        originalCallWsExecute = CallWsService.prototype.execute;
    });

    afterEach(async () => {
        SendEmail.prototype.execute = originalSendEmailExecute;
        CallWsService.prototype.execute = originalCallWsExecute;
    });

    describe('execute', () => {
        it('should successfully execute ENVIO_CORREO action when all conditions are met', async () => {
            const creator = await UsersMother.createUser(usersRepository);

            const user = await UsersMother.createUser(usersRepository, {
                created_by: creator.id.value,
            });

            const action = new Action(
                ActionMother.dto({
                    action_type: ActionTypes.ENVIO_CORREO.value,
                    entity: 'user',
                    created_by: creator.id.value,
                    allowed_roles: [],
                })
            );

            SendEmail.prototype.execute = async () => true;

            const result = await executor.execute(action, user, {}, 'create_user');

            expect(result).toBe(true);
        });

        it('should successfully execute CONSUMO_REST_FLOW action when all conditions are met', async () => {
            const creator = await UsersMother.createUser(usersRepository);
            const user = await UsersMother.createUser(usersRepository, {
                created_by: creator.id.value,
            });

            const action = new Action(
                ActionMother.dto({
                    action_type: ActionTypes.CONSUMO_REST_FLOW.value,
                    entity: 'user',
                    created_by: creator.id.value,
                    allowed_roles: [],
                })
            );

            CallWsService.prototype.execute = async () => true;

            const content = { customField: 'customValue' };
            const result = await executor.execute(action, user, content, 'create_user');

            expect(result).toBe(true);
        });

        it('should return false when ENVIO_CORREO handler fails', async () => {
            const creator = await UsersMother.createUser(usersRepository);
            const user = await UsersMother.createUser(usersRepository, {
                created_by: creator.id.value,
            });

            const action = new Action(
                ActionMother.dto({
                    action_type: ActionTypes.ENVIO_CORREO.value,
                    entity: 'user',
                    created_by: creator.id.value,
                    allowed_roles: [],
                })
            );

            SendEmail.prototype.execute = async () => false;

            const result = await executor.execute(action, user, {}, 'create_user');

            expect(result).toBe(false);
        });

        it('should return false when CONSUMO_REST_FLOW handler fails', async () => {
            const creator = await UsersMother.createUser(usersRepository);
            const user = await UsersMother.createUser(usersRepository, {
                created_by: creator.id.value,
            });

            const action = new Action(
                ActionMother.dto({
                    action_type: ActionTypes.CONSUMO_REST_FLOW.value,
                    entity: 'user',
                    created_by: creator.id.value,
                    allowed_roles: [],
                })
            );

            CallWsService.prototype.execute = async () => false;

            const result = await executor.execute(action, user, {}, 'create_user');

            expect(result).toBe(false);
        });

        it('should return false when current user is not found', async () => {
            const user = await UsersMother.createUser(usersRepository);

            const action = new Action(
                ActionMother.dto({
                    action_type: ActionTypes.ENVIO_CORREO.value,
                    entity: 'user',
                    allowed_roles: [],
                })
            );

            const result = await executor.execute(action, user, {}, 'create_user');

            expect(result).toBe(false);
        });

        it('should pass content parameter to CONSUMO_REST_FLOW handler', async () => {
            const creator = await UsersMother.createUser(usersRepository);
            const user = await UsersMother.createUser(usersRepository, {
                created_by: creator.id.value,
            });

            const action = new Action(
                ActionMother.dto({
                    action_type: ActionTypes.CONSUMO_REST_FLOW.value,
                    entity: 'user',
                    created_by: creator.id.value,
                    allowed_roles: [],
                })
            );

            const content = { customField: 'customValue' };

            CallWsService.prototype.execute = async () => true;

            const result = await executor.execute(action, user, content, 'create_user');

            expect(result).toBe(true);
        });
    });
});

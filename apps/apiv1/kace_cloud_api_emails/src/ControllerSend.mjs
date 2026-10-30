import { BaseController, HttpResponse } from '@kace/api-common';
import { CHANNEL_HUB_SEND_REJECTED } from '@kace/error-codes';
import { EmailSender } from '@kace/core/src/emails/application/send/EmailSender.js';
import { OutboundAttachmentPersister } from '@kace/core/src/emails/application/attachments/OutboundAttachmentPersister.js';
import { S3AttachmentStorage } from '@kace/core/src/emails/infrastructure/persistence/S3AttachmentStorage.js';
import { KnexEmailsRepository } from '@kace/core/src/emails/infrastructure/persistence/KnexEmailsRepository';
import { KnexEmailsBodyRepository } from '@kace/core/src/emails/infrastructure/persistence/KnexEmailsBodyRepository';
import { KnexEmailAttachmentRepository } from '@kace/core/src/emails/infrastructure/persistence/KnexEmailAttachmentRepository';
import { KnexChannelHubAccountRepository } from '@kace/core/src/channel-hub-accounts/infrastructure/persistence/KnexChannelHubAccountRepository.js';
import { KnexInteractionRepository } from '@kace/core/src/interactions/infrastructure/persistence/KnexInteractionRepository';
import { KnexCaseRepository } from '@kace/core/src/cases/infrastructure/persistence/KnexCaseRepository';
import { KnexWorkspacesRepository } from '@kace/core/src/workspaces/infrastructure/persistence/KnexWorkspacesRepository';
import { WorkflowExecutor } from '@kace/core/src/ws-rest-workflow-step/application/executor/WorkflowExecutor.js';
import { KnexWSRestWorkflowStepRepository } from '@kace/core/src/ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository.js';
import { KnexAllowedConnectionsRepository } from '@kace/core/src/allowed-conections/infrastructure/persistence/KnexAllowedConnectionsRepository.js';
import { KnexSecretsVaultRepository } from '@kace/core/src/secrets-vault/infrastructure/persistence/KnexSecretsVaultRepository.js';
import { KnexClientRepository } from '@kace/core/src/clients/infrastructure/KnexClientRepository.js';
import { KnexUsersRepository } from '@kace/core/src/users/infrastructure/KnexUsersRepository.js';
import { KnexClassificationRepository } from '@kace/core/src/classifications/infrastructure/persistence/KnexClassificationsRepository.js';
import { KnexAuxCasesRepository } from '@kace/core/src/aux_casos/infrastructure/persitance/KnexAuxCasesRepository.js';
import { KnexAuxClientsRepository } from '@kace/core/src/aux_clientes/infrastructure/persitance/KnexAuxClientsRepository.js';
import { ClientFinder } from '@kace/core/src/clients/application/find/ClientFinder.js';
import { UserFinder } from '@kace/core/src/users/domain/UserFinder.js';
import { ClassificationFinder } from '@kace/core/src/classifications/application/find/ClassificationFinder.js';
import { AuxCasesFinder } from '@kace/core/src/aux_casos/application/find/AuxCasesFinder.js';
import { AuxClientsFinder } from '@kace/core/src/aux_clientes/application/find/AuxClientsFinder.js';
import { Helper } from '@kace/core/src/shared/index.js';

export class ControllerSend extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.emailRepository = new KnexEmailsRepository(this.database_connection);
        this.emailBodyRepository = new KnexEmailsBodyRepository(this.database_connection);
        this.emailAttachmentRepository = new KnexEmailAttachmentRepository(this.database_connection);
        this.channelHubAccountRepository = new KnexChannelHubAccountRepository(this.database_connection);
        this.interactionRepository = new KnexInteractionRepository(this.database_connection);
        this.caseRepository = new KnexCaseRepository(this.database_connection);
        this.workspaceRepository = new KnexWorkspacesRepository(this.database_connection);
        this.workflowStepRepository = new KnexWSRestWorkflowStepRepository(this.database_connection);
        this.allowedConnectionRepository = new KnexAllowedConnectionsRepository(this.database_connection);
        this.secretRepository = new KnexSecretsVaultRepository(this.database_connection);
        this.clientFinder = new ClientFinder(new KnexClientRepository(this.database_connection));
        this.userFinder = new UserFinder(new KnexUsersRepository(this.database_connection));
        this.classificationFinder = new ClassificationFinder(
            new KnexClassificationRepository(this.database_connection)
        );
        this.auxCasesFinder = new AuxCasesFinder(new KnexAuxCasesRepository(this.database_connection));
        this.auxClientsFinder = new AuxClientsFinder(new KnexAuxClientsRepository(this.database_connection));
        this.started_at = new Date();
    }

    async actionCreate() {
        Helper.logInfo('Begin ControllerSend::actionCreate');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'emails', 'EmailsCreate');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create this resource.',
                    event: this.event,
                });
            }

            const payload = this.payload();

            const requiredFields = ['case_id', 'from', 'to', 'subject', 'message_to_send'];
            const missing = requiredFields.filter((f) => !payload[f]);
            if (missing.length > 0) {
                return HttpResponse.badRequest({
                    message: `Missing required fields: ${missing.join(', ')}`,
                    event: this.event,
                });
            }

            const workflowExecutor = new WorkflowExecutor(
                this.workflowStepRepository,
                this.allowedConnectionRepository,
                this.secretRepository,
                this.user
            );

            const attachmentPersister = new OutboundAttachmentPersister({
                emailAttachmentRepository: this.emailAttachmentRepository,
                attachmentStorage: new S3AttachmentStorage(),
            });

            const sender = new EmailSender({
                emailRepository: this.emailRepository,
                emailBodyRepository: this.emailBodyRepository,
                attachmentPersister,
                channelHubAccountRepository: this.channelHubAccountRepository,
                interactionRepository: this.interactionRepository,
                caseRepository: this.caseRepository,
                workspaceRepository: this.workspaceRepository,
                workflowExecutor,
                clientFinder: this.clientFinder,
                userFinder: this.userFinder,
                classificationFinder: this.classificationFinder,
                auxCasesFinder: this.auxCasesFinder,
                auxClientsFinder: this.auxClientsFinder,
            });

            const result = await sender.execute(payload, this.user.id.value);

            return HttpResponse.created({ data: result, event: this.event });
        } catch (error) {
            Helper.logError(error);
            if (error?.publicErrorCode === CHANNEL_HUB_SEND_REJECTED) {
                return HttpResponse.badRequest({
                    message: error.message,
                    event: this.event,
                    code: error.publicErrorCode,
                    publicData: { detail: error.message },
                });
            }
            if (Number.isInteger(error?.statusCode) && error.statusCode >= 400) {
                return HttpResponse.badRequest({ message: error.message, event: this.event });
            }
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End ControllerSend::actionCreate');
        }
    }
}

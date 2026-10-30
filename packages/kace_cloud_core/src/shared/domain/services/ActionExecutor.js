import { CaseFinder } from '../../../cases/domain/CaseFinder.js';
import { UserFinder } from '../../../users/domain/UserFinder.js';
import { Case } from '../../../cases/index.js';
import { AssignCurrentAdvisorCase } from '../../../actions/domain/types/AssignCurrentAdvisorCase.js';
import { AssignCurrentGroupCase } from '../../../actions/domain/types/AssignCurrentGroupCase.js';
import { AssignSelectedAdvisorsCase } from '../../../actions/domain/types/AssignSelectedAdvisorsCase.js';
import { AssignSelectedGroupsCase } from '../../../actions/domain/types/AssignSelectedGroupsCase.js';
import { AssignGroupByExternalCodeCase } from '../../../actions/domain/types/AssignGroupByExternalCodeCase.js';
import { AssignUserByExternalCodeCase } from '../../../actions/domain/types/AssignUserByExternalCodeCase.js';
import { AssignUserByExternalDynamicCode } from '../../../actions/domain/types/AssignUserByExternalDynamicCode.js';
import { AssignGroupByExternalDynamicCode } from '../../../actions/domain/types/AssignGroupByExternalDynamicCode.js';
import { SendEmail } from '../../../actions/domain/types/SendEmail.js';
import { UpdateModelCase } from '../../../actions/domain/types/UpdateModelCase.js';
import { CallWsService } from '../../../actions/domain/types/CallWsService.js';
import { Action, ActionTypes } from '../../../actions/index.js';
import { AssignationService } from '../../index.js';
import { FormulaEvaluator } from '../../../actions/domain/FormulaEvaluator.js';
import { ModelValueSaver } from '../../../actions/domain/ModelValueSaver.js';
import { Helper } from '../../infrastructure/utils/Helper.js';
import { KnexCaseAttachmentRepository } from '../../../case-attachments/index.js';
import { KnexTemplateAttachmentRepository } from '../../../template-attachments/index.js';

export class ActionExecutor {
    /** @type {FormulaEvaluator} is initialized in the constructor */
    #formulaEvaluator;
    /** @type {ModelValueSaver} is initialized in the constructor */
    #saveValueService;
    /** @type {AssignationService} is initialized in the constructor */
    #assignationService;

    /**
     *
     * @param {KnexCaseRepository} caseRepository
     * @param userRepository
     * @param grouRepository
     * @param classificationRepository
     * @param templatesRepository
     * @param mailAccountRepository
     * @param actionUpdateModelRepository
     * @param wsRestFlowRepository
     * @param globalConfigurationRepository
     * @param clientRepository
     * @param auxCasesRepository
     * @param auxClientsRepository
     * @param secretRepository
     * @param allowedConnectionRepository
     * @param {KnexWSRestWorkflowStepRepository} wsRestWorkflowStepRepository
     * @param subcaseRelationshipRepository
     * @param userListRepository
     * @param caseAttachmentRepository
     * @param {KnexStateRepository} stateRepository
     * @param {KnexTransitionsRepository} transitionRepository
     */
    constructor(
        caseRepository,
        userRepository,
        grouRepository,
        classificationRepository,
        templatesRepository,
        mailAccountRepository,
        actionUpdateModelRepository,
        wsRestFlowRepository,
        globalConfigurationRepository,
        clientRepository,
        auxCasesRepository,
        auxClientsRepository,
        secretRepository,
        allowedConnectionRepository,
        wsRestWorkflowStepRepository,
        subcaseRelationshipRepository,
        userListRepository,
        caseAttachmentRepository = new KnexCaseAttachmentRepository(caseRepository.connection),
        stateRepository = null,
        transitionRepository = null,
        templateAttachmentRepository = new KnexTemplateAttachmentRepository(templatesRepository.connection)
    ) {
        this.caseRepository = caseRepository;
        this.userRepository = userRepository;
        this.grouRepository = grouRepository;
        this.classificationRepository = classificationRepository;
        this.templatesRepository = templatesRepository;
        this.mailAccountRepository = mailAccountRepository;
        this.actionUpdateModelRepository = actionUpdateModelRepository;
        this.wsRestFlowRepository = wsRestFlowRepository;
        this.globalConfigurationRepository = globalConfigurationRepository;
        this.clientRepository = clientRepository;
        this.auxCasesRepository = auxCasesRepository;
        this.auxClientsRepository = auxClientsRepository;
        this.allowedConnectionRepository = allowedConnectionRepository;
        this.wsRestWorkflowStepRepository = wsRestWorkflowStepRepository;
        this.secretRepository = secretRepository;
        this.userListRepository = userListRepository;
        this.caseAttachmentRepository = caseAttachmentRepository;
        this.stateRepository = stateRepository;
        this.transitionRepository = transitionRepository;
        this.templateAttachmentRepository = templateAttachmentRepository;
        if (userListRepository === undefined || userListRepository === null) {
            throw new Error('userListRepository is required');
        }

        this.caseFinder = new CaseFinder(caseRepository);
        this.userFinder = new UserFinder(userRepository);

        this.#assignationService = new AssignationService(
            grouRepository,
            globalConfigurationRepository,
            userRepository
        );
        this.#formulaEvaluator = new FormulaEvaluator(
            caseRepository,
            clientRepository,
            auxCasesRepository,
            auxClientsRepository
        );
        this.#saveValueService = new ModelValueSaver(
            caseRepository,
            clientRepository,
            auxCasesRepository,
            auxClientsRepository,
            grouRepository,
            globalConfigurationRepository,
            subcaseRelationshipRepository
        );
    }

    /**
     *
     * @param {Action} action
     * @param {Aggregate} entity
     * @returns
     */
    async execute(action, entity, content = {}, trigger = null) {
        try {
            let entityModel;
            if (action.entity.value === 'user') {
                entityModel = await this.userFinder.execute(entity.id.value);
            } else if (action.entity.value === 'group') {
                entityModel = await this.grouRepository.find(entity.id);
            } else {
                if (!(entity instanceof Case)) {
                    Helper.logDebug('ActionExecutor: entity is not an instance of Case. entity: ', entity);
                    return false;
                }
                entityModel = await this.caseFinder.execute(entity.id.value);
            }

            if (!entityModel) {
                Helper.logDebug(
                    `ActionExecutor: entityModel is not found. ${action.entity.value || 'case'}Id: `,
                    entity.id.value
                );
                return false;
            }

            const currentUserId = entity.updated_by.value || entity.created_by.value;
            const currentUser = await this.userFinder.execute(currentUserId);
            if (!currentUser) {
                Helper.logDebug('ActionExecutor: currentUser is not found. currentUserId: ', currentUserId);
                return false;
            }

            if (!(action instanceof Action) || !action.hasPermission(currentUser)) {
                Helper.logDebug('ActionExecutor: action is not an instance of Action. action: ', action);
                return false;
            }

            const actionType = action.action_type.value;
            Helper.logDebug('ActionExecutor: actionType: ', actionType);
            let caseHandler = null;
            if (actionType === ActionTypes.ASIGNAR_ASESOR_EN_CURSO.value) {
                caseHandler = new AssignCurrentAdvisorCase(this.caseRepository, this.userRepository);
            }
            if (actionType === ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value) {
                caseHandler = new AssignCurrentGroupCase(
                    this.caseRepository,
                    this.userRepository,
                    this.#assignationService
                );
            }
            // SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
            // TODO: el frontal debe enviar el id del usuario
            if (actionType === ActionTypes.ASIGNAR_LISTA_ASESORES.value) {
                caseHandler = new AssignSelectedAdvisorsCase(this.caseRepository, this.userListRepository);
            }
            // SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
            // TODO: el frontal debe enviar el id del grupo y pasar el servicio de asignación
            if (actionType === ActionTypes.ASIGNAR_LISTA_GRUPOS.value) {
                caseHandler = new AssignSelectedGroupsCase(
                    this.caseRepository,
                    this.userRepository,
                    this.classificationRepository,
                    this.#assignationService
                );
            }
            if (actionType === ActionTypes.ASIGNAR_USUARIO_POR_CODIGO_EXTERNO.value) {
                caseHandler = new AssignUserByExternalCodeCase(this.caseRepository, this.userRepository);
            }
            if (actionType === ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO.value) {
                caseHandler = new AssignGroupByExternalCodeCase(
                    this.caseRepository,
                    this.userRepository,
                    this.grouRepository,
                    this.classificationRepository,
                    this.#assignationService
                );
            }
            if (actionType === ActionTypes.ENVIO_CORREO.value) {
                // SendEmail constructor positional layout (17 params, see packages/kace_cloud_core/src/actions/domain/types/SendEmail.js):
                //   1. templatesRepository
                //   2. mailAccountRepository
                //   3. clientRepository
                //   4. userRepository
                //   5. classificationRepository
                //   6. auxCasesRepository
                //   7. auxClientsRepository
                //   8. secretRepository
                //   9. caseAttachmentRepository
                //  10. caseAttachmentReader (default = new S3CaseAttachmentReader())
                //  11. emailService (default = new EmailService(secretRepository))
                //  12. eventLogger (default = new EventLogger(templatesRepository))
                //  13. stateRepository (default = null)
                //  14. transitionRepository (default = null)
                //  15. inlineImageEmbedder (default = new ChannelHubInlineImageEmbedder(...))
                //  16. templateAttachmentEmbedder (default = new TemplateAttachmentInlineImageEmbedder(...))
                //  17. templateAttachmentRepository
                // The `undefined` slots (10–12, 15–16) explicitly opt into the
                // constructor defaults. If a future refactor inserts a new
                // optional parameter anywhere before slot 17, this call must
                // be updated to keep templateAttachmentRepository aligned.
                caseHandler = new SendEmail(
                    /*  1 templatesRepository     */ this.templatesRepository,
                    /*  2 mailAccountRepository   */ this.mailAccountRepository,
                    /*  3 clientRepository        */ this.clientRepository,
                    /*  4 userRepository          */ this.userRepository,
                    /*  5 classificationRepository*/ this.classificationRepository,
                    /*  6 auxCasesRepository      */ this.auxCasesRepository,
                    /*  7 auxClientsRepository    */ this.auxClientsRepository,
                    /*  8 secretRepository        */ this.secretRepository,
                    /*  9 caseAttachmentRepository*/ this.caseAttachmentRepository,
                    /* 10 caseAttachmentReader    */ undefined,
                    /* 11 emailService            */ undefined,
                    /* 12 eventLogger             */ undefined,
                    /* 13 stateRepository         */ this.stateRepository,
                    /* 14 transitionRepository    */ this.transitionRepository,
                    /* 15 inlineImageEmbedder     */ undefined,
                    /* 16 templateAttachmentEmbedder*/ undefined,
                    /* 17 templateAttachmentRepository*/ this.templateAttachmentRepository
                );
            }
            if (actionType === ActionTypes.ACTUALIZAR_MODELO.value) {
                caseHandler = new UpdateModelCase(
                    this.caseRepository,
                    this.actionUpdateModelRepository,
                    this.#formulaEvaluator,
                    this.#saveValueService
                );
            }
            if (actionType === ActionTypes.CONSUMO_REST_FLOW.value) {
                // SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
                //TODO: mandar body dinamico (content) al rest
                Helper.logDebug('ActionExecutor:', content);
                switch (action.entity.value) {
                    case 'user':
                        caseHandler = new CallWsService(
                            this.userRepository,
                            this.wsRestFlowRepository,
                            this.wsRestWorkflowStepRepository,
                            this.secretRepository,
                            this.allowedConnectionRepository,
                            currentUser,
                            content
                        );
                        break;
                    case 'group':
                        caseHandler = new CallWsService(
                            this.grouRepository,
                            this.wsRestFlowRepository,
                            this.wsRestWorkflowStepRepository,
                            this.secretRepository,
                            this.allowedConnectionRepository,
                            currentUser,
                            content
                        );
                        break;
                    default:
                        caseHandler = new CallWsService(
                            this.caseRepository,
                            this.wsRestFlowRepository,
                            this.wsRestWorkflowStepRepository,
                            this.secretRepository,
                            this.allowedConnectionRepository,
                            currentUser,
                            content
                        );
                }
            }
            if (actionType === ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO_DINAMICO.value) {
                caseHandler = new AssignGroupByExternalDynamicCode(
                    this.caseRepository,
                    this.userRepository,
                    this.grouRepository,
                    this.classificationRepository,
                    this.#assignationService,
                    this.auxCasesRepository
                );
            }
            if (actionType === ActionTypes.ASIGNAR_USUARIO_POR_CODIGO_EXTERNO_DINAMICO.value) {
                caseHandler = new AssignUserByExternalDynamicCode(
                    this.caseRepository,
                    this.userRepository,
                    this.auxCasesRepository
                );
            }
            Helper.logDebug('ActionExecutor: caseHandler: ', typeof caseHandler);
            const result = await caseHandler.execute(entityModel, action, trigger);
            return result;
        } catch (error) {
            Helper.logError('ActionExecutor error:', error);
            return false;
        }
    }
}

import {
    BaseController,
    HttpResponse,
    SearchAuthorizationError,
    SearchAuthorizationService,
    applyServerManagedFields,
} from '@kace/api-common';
import {
    schemaCreate,
    schemaDelete,
    schemaUpdate,
    auxiliaryCreateSchema,
    auxiliaryUpdateSchema,
    caseWithAuxSchema,
    createDescriptionSchema,
    updateDescriptionSchema,
} from './schemas.mjs';
import { SearchSchema } from '@kace/api-common/src/validation/schemas/SearchSchema';
import {
    CaseDeleter,
    CaseFinder,
    CaseSearcher,
    CaseUpdater,
    KnexCaseRepository,
    KnexSubcaseRelationshipRepository,
    SubCaseRelationCreator,
    SubCaseRelationDeleter,
    RelationsCaseSearcher,
    CaseFolioGenerator,
    CaseAuditTouch,
    isAuxiliaryAuditOnlyPayload,
    CaseReclassifier,
    DomainCaseFinder,
    applyAuxiliaryReclassification,
} from '@kace/core/src/cases';
import { KnexClassificationRepository } from '@kace/core/src/classifications';
import { KnexClassificationGroupRelationshipRepository } from '@kace/core/src/classification-group-relationships';
import { CommentCreator, KnexCommentsRepository } from '@kace/core/src/comments';
import { KnexAuxCasesRepository } from '@kace/core/src/aux_casos/infrastructure/persitance/KnexAuxCasesRepository';
import { CustomError } from '@kace/core/src/shared/errors/CustomError';
import { CASE_RECLASSIFY_PERMISSION, Helper, ValidationFailError } from '@kace/core/src/shared/index.js';
import { CaseStaleSnapshotEvaluator } from '@kace/core/src/cases/application/CaseStaleSnapshotEvaluator.js';
import { SchemaConversionsApplier } from '@kace/core/src/shared/domain/services/SchemaConversionsApplier.js';
import { KnexBoardsRepository } from '@kace/core/src/boards/infrastructure/persistence/KnexBoardsRepository';
import { BoardPermissionChecker } from '@kace/core/src/boards/application/BoardPermissionChecker.js';
import KnexFakeCaseRepository from '@kace/core/src/fake-cases/infrastructure/persistence/KnexFakeCaseRepository.js';
import FakeCaseUpdater from '@kace/core/src/fake-cases/application/update/FakeCaseUpdater.js';
import FakeCaseFinder from '@kace/core/src/fake-cases/domain/Finder.js';
import { FakeCaseCreator } from '@kace/core/src/fake-cases/application/create/FakeCaseCreator.js';
import { AuxCasesCreator } from '@kace/core/src/aux_casos/application/create/AuxCasesCreator';
import { AuxCasesUpdater } from '@kace/core/src/aux_casos/application/update/AuxCasesUpdater';
import { KnexAuxDefinitionsRepository } from '@kace/core/src/aux_definitions/infrastructure/persitance/KnexAuxDefinitionsRepository';
import { AuxDefinitionTableNameFinder } from '@kace/core/src/aux_definitions/domain/AuxDefinitionTableNameFinder';
import { KnexSchemasRepository } from '@kace/core/src/schemas/infrastructure/persistence/KnexSchemasRepository';
import { SchemaRules } from '@kace/core/src/schemas/application/rules/SchemaRules';
import SchemaBuilder from '@kace/schemabuilder/src/SchemaBuilder.js';
import { AdvancedSearch } from '@kace/core/src/shared/domain/services/AdvancedSearch';
import {
    CaseDescriptionCreator,
    CaseDescriptionUpdater,
    KnexCaseDescriptionRepository,
    isCaseDescriptionEditLocked,
} from '@kace/core/src/case-descriptions';
import { CaseDescriptionEditLockedError } from '@kace/core/src/shared/errors/CaseDescriptionEditLockedError.js';
import ParentUpdater from '@kace/core/src/cases/application/update/ParentUpdater.js';
import { KnexOneScriptRepository } from '@kace/core/src/one-script/index.js';
import { KnexTransitionsCaseRepository } from '@kace/core/src/cases/infrastructure/persistence/KnexTransitionsCaseRepository.js';
import { KnexTransitionRuleRepository } from '@kace/core/src/transition-rules/infrastructure/KnexTransitionRuleRepository.js';
import { validationFailPublicFields } from '@kace/api-common/src/http_responses/HttpResponse.js';
import { KnexFolioConfigurationRepository } from '@kace/core/src/folio-configurations/infrastructure/KnexFolioConfigurationRepository.js';
import { KnexFolioSequenceRepository } from '@kace/core/src/folio-configurations/infrastructure/KnexFolioSequenceRepository.js';
import { CaseFolioResolver } from '@kace/core/src/cases/application/folio/CaseFolioResolver.js';
import { AuxCasesFinderByCase } from '@kace/core/src/aux_casos/domain/AuxCasesFinderByCase.js';
import { TransitionRuleValidator } from '@kace/core/src/transition-rules/domain/TransitionRuleValidator.js';
import { PhaseTimer } from './PhaseTimer.mjs';
import { ensureRelationshipsExist } from '@kace/core/src/cases/application/relationships/ensureRelationshipsExist.js';
import { CaseCreator2 } from '@kace/core/src/cases/application/create/CaseCreator2.js';

export class Controller extends BaseController {
    /**
     * is initialized in the constructor
     * @type {KnexAuxDefinitionsRepository}
     */
    #auxDefinitionsRepository;

    /**
     * is initialized in the constructor
     * @type {AuxDefinitionTableNameFinder}
     */
    #auxDefinitionTableNameFinder;

    /**
     * is initialized in the constructor
     * @type {KnexSchemasRepository}
     */
    #schemasRepository;

    /**
     * is initialized in the constructor
     * @type {SchemaRules}
     */
    #schemaRules;

    /**
     * @type {KnexOneScriptRepository}
     */
    #knexOneScriptRepository;

    /**
     * @type {KnexBoardsRepository}
     */
    #boardsRepository;

    /**
     * @type {BoardPermissionChecker}
     */
    #boardPermissionChecker;

    constructor(event, knexConfig, readerConfig = null) {
        super(event, knexConfig);
        this.repository = new KnexCaseRepository(knexConfig, readerConfig);
        this.commentsRepository = new KnexCommentsRepository(this.repository.connection);
        this.classificationsRepository = new KnexClassificationRepository(this.repository.connection);
        this.classificationGroupRelationshipRepository = new KnexClassificationGroupRelationshipRepository(
            this.repository.connection
        );
        this.fakeCaseRepository = new KnexFakeCaseRepository(this.repository.connection);
        this.fakeCaseUpdaterFactory = (repository) => new FakeCaseUpdater(repository);
        this.started_at = new Date();
        this.auxiliaryRepository = new KnexAuxCasesRepository(this.database_connection);
        this.#auxDefinitionsRepository = new KnexAuxDefinitionsRepository(this.repository.connection);
        this.#auxDefinitionTableNameFinder = new AuxDefinitionTableNameFinder(this.#auxDefinitionsRepository);
        this.#schemasRepository = new KnexSchemasRepository(this.repository.connection);
        this.#schemaRules = new SchemaRules(this.#schemasRepository);
        this.subCasesRepository = new KnexSubcaseRelationshipRepository(this.repository.connection);
        this.relationCreator = new SubCaseRelationCreator(this.subCasesRepository);
        this.relationDeleter = new SubCaseRelationDeleter(this.subCasesRepository);
        this.descriptionRepository = new KnexCaseDescriptionRepository(this.repository.connection);
        this.descriptionCreator = new CaseDescriptionCreator(this.descriptionRepository);
        this.#knexOneScriptRepository = new KnexOneScriptRepository(this.repository.connection);
        this.#boardsRepository = new KnexBoardsRepository(this.database_connection);
        this.#boardPermissionChecker = new BoardPermissionChecker(this.#boardsRepository);

        this.transitionsCaseRepository = new KnexTransitionsCaseRepository(this.database_connection);
        this.transitionRuleRepository = new KnexTransitionRuleRepository(this.database_connection);

        this.actionExecutionService = this.getActionExecutionService(this.repository, this.database_connection);

        /*
         * Configurable folio (radicado). Independent of the legacy external_code folio.
         * Built on the pool this controller already owns, like every other repository above:
         * passing knexConfig would open two more pools per invocation that run() never closes.
         */
        this.folioConfigurationRepository = new KnexFolioConfigurationRepository(this.repository.connection);
        this.folioSequenceRepository = new KnexFolioSequenceRepository(this.repository.connection);
        this.caseFolioResolver = new CaseFolioResolver(this.folioConfigurationRepository, this.folioSequenceRepository);
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');
        try {
            const boardId = this.pathParameters()?.board_id;
            const role = this.pathParameters()?.role;
            let hasPermission;
            if (boardId && (role === 'agente' || role === 'administrador')) {
                hasPermission = await this.#boardPermissionChecker.execute(
                    this.user,
                    boardId,
                    'can_create_record',
                    'BoardsCreateRegister',
                    role
                );
                if (!hasPermission) {
                    return HttpResponse.forbidden({
                        message: 'You do not have permission to create this resource.',
                        event: this.event,
                    });
                }
            }

            hasPermission = this.user.hasPermission('agente', 'cases', 'CasesCreate');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create this resource.',
                    event: this.event,
                });
            }

            const payload = this.payload();
            payload.created_at = this.started_at;
            payload.created_by = this.user.id.value;

            const { value, error } = schemaCreate.validate(payload, {
                abortEarly: false,
            });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            await this.#ensureClientRelationship(value.cliente_id);
            await this.#ensureTransitionRelationship(value.transicion_id);
            await this.#ensureResponsableRelationship(value.responsable_id);
            await this.#ensureClasificationRelationship(value.clasificacion_id);
            await this.#ensureGroupRelationship(value.grupo_id);

            /*
             * Wrapped in a transaction so the folio's consecutive is reserved atomically
             * with the INSERT: on failure the rollback returns the number instead of
             * burning it. Side-effects are deferred to runPostPersistence() after commit.
             */
            let creatorForPost;
            let kaseForPost;
            const response = await this.repository.connection.transaction(async (trx) => {
                const creator = new CaseCreator2(
                    this.repository,
                    this.actionExecutionService,
                    this.eventPublisher,
                    this.tenant,
                    this.user,
                    this.transitionRuleRepository,
                    this.transitionsCaseRepository
                );
                /*
                 * No auxiliary on this route: a configuration using an aux_cases.* path
                 * fails here with a 400 naming the segment, which is the correct signal.
                 */
                const persisted = await creator.execute(value, { trx, folioResolver: this.caseFolioResolver });
                creatorForPost = creator;
                kaseForPost = persisted.kase;
                return persisted.response;
            });

            /*
             * AFTER commit, best-effort: the case is already persisted, so a failure here
             * must not surface as a 500 that makes the caller retry into a duplicate.
             */
            try {
                await creatorForPost.runPostPersistence(kaseForPost);
            } catch (postErr) {
                Helper.logError('actionCreate: runPostPersistence failed after commit', postErr);
            }

            const existsCase = await new FakeCaseFinder(this.fakeCaseRepository).execute({ value: value.id });
            if (!existsCase) {
                await new FakeCaseCreator(this.fakeCaseRepository).execute({
                    ...value,
                    transicion_id: null,
                });
            } else {
                await new FakeCaseUpdater(this.fakeCaseRepository).execute(value.id, {
                    ...value,
                    transicion_id: null,
                });
            }

            return HttpResponse.created({ ...response.toJson(), event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionCreate');
        }
    }

    async actionUpdate() {
        Helper.logInfo('Begin actionUpdate');
        try {
            const boardId = this.pathParameters()?.board_id;
            const role = this.pathParameters()?.role;
            let hasPermission;
            if (boardId && (role === 'agente' || role === 'administrador')) {
                hasPermission = await this.#boardPermissionChecker.execute(
                    this.user,
                    boardId,
                    'can_edit_record',
                    'BoardsUpdateRegister',
                    role
                );
                if (!hasPermission) {
                    return HttpResponse.forbidden({
                        message: 'You do not have permission to update this resource.',
                        event: this.event,
                    });
                }
            }

            hasPermission = this.user.hasPermission('agente', 'cases', 'CasesUpdate');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to update this resource.',
                    event: this.event,
                });
            }

            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({
                    message: 'Invalid id',
                    event: this.event,
                });
            }

            const payload = applyServerManagedFields(this.payload(), {
                operation: 'update',
                userId: this.user.id.value,
                now: this.started_at,
            });
            const { value, error } = schemaUpdate.validate(payload, {
                abortEarly: false,
            });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            if (!this.user?.isServiceAccount) {
                value.edited_by = this.user.id.value;
                value.edited_at = payload.updated_at;
            }

            if (value.cliente_id) {
                await this.#ensureClientRelationship(value.cliente_id);
            }
            if (value.transicion_id) {
                await this.#ensureTransitionRelationship(value.transicion_id);
            }
            if (value.responsable_id) {
                await this.#ensureResponsableRelationship(value.responsable_id);
            }
            if (value.clasificacion_id) {
                await this.#ensureClasificationRelationship(value.clasificacion_id);
            }
            if (value.grupo_id) {
                await this.#ensureGroupRelationship(value.grupo_id);
            }

            await new CaseUpdater(
                this.repository,
                this.actionExecutionService,
                this.user,
                this.eventPublisher,
                this.tenant,
                this.transitionRuleRepository,
                this.transitionsCaseRepository
            ).execute(id, value);
            await this.fakeCaseUpdaterFactory(this.fakeCaseRepository).execute(id, {
                ...value,
                transicion_id: null,
            });

            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionUpdate');
        }
    }

    async actionDelete() {
        Helper.logInfo('Begin actionDelete');
        try {
            const hasPermission = this.user.hasPermission('agente', 'cases', 'CasesCreate');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to delete this resource.',
                    event: this.event,
                });
            }

            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({
                    message: 'Invalid id',
                    event: this.event,
                });
            }

            const payload = this.payload();

            const { value: body, error } = schemaDelete.validate(payload, {
                abortEarly: false,
            });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            const { comment, ...dataUpdate } = body;

            if (comment) {
                comment.created_at = this.started_at;
                comment.created_by = this.user.id.value;
                comment.caso_id = id;
                await new CommentCreator(this.commentsRepository).execute(comment);
            }

            const dto = {
                ...dataUpdate,
                updated_at: new Date(),
                updated_by: this.user.id.value,
                deleted_at: new Date(),
                deleted_by: this.user.id.value,
            };

            await new CaseDeleter(this.repository).execute(id, dto);

            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionDelete');
        }
    }

    async actionRead() {
        Helper.logInfo('Begin actionRead');
        try {
            const boardId = this.pathParameters()?.board_id;
            const role = this.pathParameters()?.role;
            let hasPermission;
            if (boardId && (role === 'agente' || role === 'administrador')) {
                hasPermission = await this.#boardPermissionChecker.execute(
                    this.user,
                    boardId,
                    'can_view_record',
                    'BoardsReadRegister',
                    role
                );
                if (!hasPermission) {
                    return HttpResponse.forbidden({
                        message: 'You do not have permission to read this resource.',
                        event: this.event,
                    });
                }
            }

            hasPermission = this.user.hasPermission('administrador', 'cases', 'CasesRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({
                    message: 'Invalid id',
                    event: this.event,
                });
            }

            const isOneScriptOrigin = this.getHeader('referer')?.includes('onescript.konecta.cloud');
            const qs = this.event?.queryStringParameters ?? {};
            const logEvent = !isOneScriptOrigin || qs?.logEvent === 'true';
            const response = await new CaseFinder(this.repository, this.user).executeWithAllRelations(id, logEvent);

            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionRead');
        }
    }

    async actionIndex() {
        Helper.logInfo('Begin actionIndex');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'cases', 'CasesRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const dtoCriteria = {
                filter: undefined,
                relationship: undefined,
                limit: 10,
                offset: 0,
                order: {
                    field: 'created_at',
                    direction: 'desc',
                },
            };

            const response = await new CaseSearcher(this.repository).execute(dtoCriteria);

            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionIndex');
        }
    }

    #searchAuthorizationService;

    #authorizeSearch(endpointKey, query) {
        this.#searchAuthorizationService ??= new SearchAuthorizationService();
        return this.#searchAuthorizationService.authorize({
            endpointKey,
            user: this.user,
            query,
        });
    }

    async actionSearch() {
        Helper.logInfo('Begin actionSearch');
        try {
            const hasAdminPermission = this.user.hasPermission('administrador', 'cases', 'CasesRead');
            const hasAgentPermission = this.user.hasPermission('agente', 'cases', 'CasesRead');

            if (!hasAdminPermission && !hasAgentPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const { value, error } = SearchSchema.validate(this.payload(), {
                abortEarly: false,
            });
            if (error) {
                return HttpResponse.validationsFail({ errors: error, event: this.event });
            }

            const qs = this.event?.queryStringParameters ?? {};
            const extraInfoFlag = qs?.extrainfo === '1' || qs?.extrainfo === 1;

            const SearcherClass = extraInfoFlag ? RelationsCaseSearcher : CaseSearcher;
            const authorizedQuery = this.#authorizeSearch('cases-2.search', value);
            const response = await new SearcherClass(this.repository).execute(authorizedQuery);

            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            if (error instanceof SearchAuthorizationError) {
                return HttpResponse.forbidden({
                    message: error.message,
                    event: this.event,
                });
            }

            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionSearch');
        }
    }

    async actionCreateWithAux() {
        Helper.logInfo('Begin actionCreateWithAux');
        const timer = new PhaseTimer();
        try {
            const boardId = this.pathParameters()?.board_id;
            const role = this.pathParameters()?.role;
            let hasPermission;
            if (boardId && (role === 'agente' || role === 'administrador')) {
                hasPermission = await this.#boardPermissionChecker.execute(
                    this.user,
                    boardId,
                    'can_create_record',
                    'BoardsCreateRegister',
                    role
                );
                if (!hasPermission) {
                    return HttpResponse.forbidden({
                        message: 'You do not have permission to create this resource.',
                        event: this.event,
                    });
                }
            }

            hasPermission = this.user.hasPermission('agente', 'cases', 'CasesCreate');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create this resource.',
                    event: this.event,
                });
            }

            const payload = this.payload();

            const endConfig = timer.start('config');
            await this.getGlobalConfig();
            endConfig();

            const endValidaciones = timer.start('validaciones');
            const endValJoiCaseWithAux = timer.start('val_joi');
            const { error } = caseWithAuxSchema.validate(payload, {
                abortEarly: false,
            });
            endValJoiCaseWithAux();
            if (error) {
                endValidaciones();
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            payload.case.created_at = this.started_at;
            payload.case.created_by = this.user.id.value;
            payload.aux_cases.created_at = this.started_at;
            payload.aux_cases.created_by = this.user.id.value;

            const endValJoiCase = timer.start('val_joi');
            const { value: caseValue, error: caseError } = schemaCreate.validate(payload.case, { abortEarly: false });
            endValJoiCase();
            if (caseError) {
                endValidaciones();
                return HttpResponse.validationsFail({
                    errors: caseError,
                    event: this.event,
                });
            }

            if (!payload.description) {
                payload.description = {};
                payload.description.descripcion = ' ';
            }

            const hasCaseDescriptionId = !!payload.case.descripcion_caso_id;
            if (hasCaseDescriptionId) {
                payload.description.id = payload.case.descripcion_caso_id;
            }

            payload.description.created_at = this.started_at;
            payload.description.created_by = this.user.id.value;

            const endValJoiDescription = timer.start('val_joi');
            const { error: descriptionError, value: descriptionValue } = createDescriptionSchema.validate(
                payload.description,
                {
                    abortEarly: false,
                }
            );
            endValJoiDescription();
            if (descriptionError) {
                endValidaciones();
                return HttpResponse.validationsFail({
                    errors: descriptionError,
                    event: this.event,
                });
            }

            if (!hasCaseDescriptionId) {
                caseValue.descripcion_caso_id = descriptionValue.id;
            }

            payload.aux_cases.caso_id = caseValue.id;
            const endValJoiAux = timer.start('val_joi');
            const { value: auxValue, error: auxError } = auxiliaryCreateSchema.validate(payload.aux_cases, {
                abortEarly: false,
            });
            endValJoiAux();
            if (auxError) {
                endValidaciones();
                return HttpResponse.validationsFail({
                    errors: auxError,
                    event: this.event,
                });
            }

            const endValAuxDef = timer.start('val_aux_def');
            const auxDefinition = await this.#auxDefinitionTableNameFinder.execute(this.auxiliaryRepository.tableName);
            endValAuxDef();

            // Validate if any form is required
            const endValSchemaRulesAux = timer.start('val_schema_rules');
            const schema = await this.#schemaRules.execute(auxDefinition.schema_id.value);
            endValSchemaRulesAux();
            const dataStructure = schema.toJson().data.data_structure;
            if (Object.keys(auxValue.data).length === 0) {
                for (const key in dataStructure) {
                    if ((dataStructure[key]?.required ?? false) === true) {
                        endValidaciones();
                        return HttpResponse.validationsFail({
                            message: 'Validations fail',
                            errors: new ValidationFailError(`The field "${key}" is required`, key),
                            event: this.event,
                        });
                    }
                }
            }

            // Validate if any field is required
            const endValOneScript = timer.start('val_one_script');
            const formSchemaData = await this.#knexOneScriptRepository.findByGroupIdAndClassificationId(
                caseValue.grupo_id,
                caseValue.clasificacion_id
            );
            endValOneScript();
            if (formSchemaData) {
                const endValSchemaRulesForm = timer.start('val_schema_rules');
                const formSchema = await this.#schemaRules.execute(formSchemaData.schema_id);
                endValSchemaRulesForm();
                const dataStructureFormSchema = formSchema.toJson().data.data_structure;
                if (Object.keys(auxValue.data).length === 0) {
                    for (const key in dataStructureFormSchema) {
                        if ((dataStructureFormSchema[key]?.required ?? false) === true) {
                            endValidaciones();
                            return HttpResponse.validationsFail({
                                message: 'Validations fail',
                                errors: new ValidationFailError(`The field "${key}" is required`, key),
                                event: this.event,
                            });
                        }
                    }
                }
            }

            if (Object.entries(auxValue.data).length > 0) {
                const endValSchemaBuild = timer.start('val_schema_build');
                const partialKeys = Object.keys(auxValue.data);
                const partialDataStructure = SchemaBuilder.buildPartial(dataStructure, partialKeys);
                const joiBuilderValidation = SchemaBuilder.build(partialDataStructure);
                const valueData = joiBuilderValidation.validate(auxValue.data, {
                    abortEarly: false,
                });
                endValSchemaBuild();

                if (valueData.error) {
                    endValidaciones();
                    return HttpResponse.validationsFail({
                        errors: valueData.error,
                        event: this.event,
                    });
                }

                auxValue.data = SchemaConversionsApplier.execute({
                    target: auxValue.data,
                    converted: valueData.value,
                    dataStructure: partialDataStructure,
                });
            }
            endValidaciones();

            const endLecturasFk = timer.start('lecturas_fk');
            await this.#validateForeignKeysExist({
                clienteId: caseValue.cliente_id,
                transicionId: caseValue.transicion_id,
                responsableId: caseValue.responsable_id,
                clasificacionId: caseValue.clasificacion_id,
                grupoId: caseValue.grupo_id,
            });
            endLecturasFk();

            const endTransitionRules = timer.start('transition_rules');
            if (caseValue.transicion_id) {
                await TransitionRuleValidator.enforceRuleForTransitionWithMergedContext(
                    caseValue.transicion_id,
                    this.transitionsCaseRepository,
                    this.transitionRuleRepository,
                    this.repository,
                    {
                        contextOverrides: payload,
                    }
                );
            }
            endTransitionRules();

            const endFolio = timer.start('folio');
            const behaviorConfig = (await this.getGlobalConfig()).settings.behaviors.getConfig('agente', 'casos');

            if (caseValue.external_code) {
                caseValue.external_code = await new CaseFolioGenerator(this.repository).execute(
                    caseValue.external_code,
                    behaviorConfig
                );
            }
            endFolio();

            const caseCreatorConfig = {
                ...behaviorConfig,
                add_folio_to_external_code: false,
                /*
                 * transition already validated above via enforceRuleForTransitionWithMergedContext.
                 * Note: transitionsCaseRepository (7th constructor arg) is also intentionally omitted
                 * below, so this flag is defense-in-depth.
                 */
                skipTransitionValidation: true,
                /*
                 * Configurable folio: CaseCreator reserves the consecutive inside the same
                 * transaction (added below as config.trx), so a rollback returns the number.
                 * auxValue.data is the unwrapped aux_cases.data that aux_cases.* paths resolve against.
                 */
                folioResolver: this.caseFolioResolver,
                auxData: auxValue.data,
            };

            /*
             * Atomic persistence: aux + description + case (each with its history) commit together
             * or roll back together. Side-effects (event publish, SLA timers, event logging) are
             * deferred to runPostPersistence() and run only AFTER the transaction commits, so no
             * event is emitted for a case that might roll back and SLA reads see committed data.
             */
            const endWrite = timer.start('insert_tx');
            let caseCreatorForPost;
            let kaseSavedForPost;
            const response = await this.repository.connection.transaction(async (trx) => {
                await new AuxCasesCreator(this.auxiliaryRepository).execute(
                    { ...auxValue, external_code: caseValue.external_code },
                    dataStructure,
                    trx
                );
                await this.descriptionCreator.execute(descriptionValue, trx);
                const creator = new CaseCreator2(
                    this.repository,
                    this.actionExecutionService,
                    this.eventPublisher,
                    this.tenant,
                    this.user,
                    this.transitionRuleRepository
                );
                const persisted = await creator.execute(caseValue, { ...caseCreatorConfig, trx });
                caseCreatorForPost = creator;
                kaseSavedForPost = persisted.kase;
                return persisted.response;
            });
            endWrite();

            /*
             * AFTER commit: side-effects (event publish, SLA timers, event logging).
             * These are best-effort: the case is already persisted. A failure here must
             * NOT surface as a 500 (which would cause the caller to retry → duplicate).
             */
            const endPostCommit = timer.start('post_commit');
            try {
                await caseCreatorForPost.runPostPersistence(kaseSavedForPost);
            } catch (postErr) {
                Helper.logError(
                    'actionCreateWithAux: runPostPersistence failed after commit (case already persisted)',
                    postErr
                );
            }
            endPostCommit();

            /*
             * When async_case_post_processing is enabled for the tenant, these side-effects
             * (parent relation/update and fake-case sync) are handled asynchronously by the
             * CasePostProcessingOnCaseCreated handler on kace.core.case.created. Running them
             * here too would duplicate the work, so they are gated behind the flag.
             * Default false (key injected by Behaviors) → blocks still run → no behavior change.
             */
            const asyncEnabled = behaviorConfig?.async_case_post_processing === true;

            const endParentLink = timer.start('parent_link');
            if (!asyncEnabled && caseValue.parent_id) {
                await this.relationCreator.execute(caseValue.parent_id, caseValue.id, this.user.id.value);
                const parentUpdater = new ParentUpdater(this.auxiliaryRepository);
                await parentUpdater.execute(caseValue.id, caseValue.parent_id);
            }
            endParentLink();

            const endFakeCase = timer.start('fake_case');
            if (!asyncEnabled) {
                const existsCase = await new FakeCaseFinder(this.fakeCaseRepository).execute({ value: caseValue.id });
                if (!existsCase) {
                    await new FakeCaseCreator(this.fakeCaseRepository).execute({
                        ...caseValue,
                        transicion_id: null,
                    });
                } else {
                    await new FakeCaseUpdater(this.fakeCaseRepository).execute(caseValue.id, {
                        ...caseValue,
                        transicion_id: null,
                    });
                }
            } else {
                /*
                 * Async path: the case is already committed above, so its row exists for the
                 * CasePostProcessingOnCaseCreated consumer to load by aggregateId. Publish ONE
                 * CasePostProcessingRequested event to hand the parent-relation + fake-case work
                 * off asynchronously. Best-effort: a publish failure is logged and swallowed so
                 * the request still returns 201 (the case is already persisted).
                 * await publishCasePostProcessingRequested(
                 *     this.eventPublisher,
                 *     caseValue,
                 *     this.tenant.id.value,
                 *     this.user.id.value
                 * );
                 */
            }
            endFakeCase();

            return HttpResponse.created({ ...response.toJson(), event: this.event });
        } catch (error) {
            if (error instanceof ValidationFailError) {
                return HttpResponse.validationsFail({
                    message: error.message,
                    event: this.event,
                    ...validationFailPublicFields(error),
                });
            }
            Helper.logError(error.message, error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('actionCreateWithAux.timing', timer.summary());
            Helper.logInfo('End actionCreateWithAux');
        }
    }

    async actionUpdateWithAux() {
        Helper.logInfo('Begin actionUpdateWithAux');
        try {
            const boardId = this.pathParameters()?.board_id;
            const role = this.pathParameters()?.role;
            let hasPermission;
            if (boardId && (role === 'agente' || role === 'administrador')) {
                hasPermission = await this.#boardPermissionChecker.execute(
                    this.user,
                    boardId,
                    'can_edit_record',
                    'BoardsUpdateRegister',
                    role
                );
                if (!hasPermission) {
                    return HttpResponse.forbidden({
                        message: 'You do not have permission to update this resource.',
                        event: this.event,
                    });
                }
            }

            hasPermission = this.user.hasPermission('agente', 'cases', 'CasesUpdate');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to update this resource.',
                    event: this.event,
                });
            }

            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({
                    message: 'Invalid id',
                    event: this.event,
                });
            }

            const payload = this.payload();

            const { error } = caseWithAuxSchema.validate(payload, {
                abortEarly: false,
            });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            payload.case = applyServerManagedFields(payload.case, {
                operation: 'update',
                userId: this.user.id.value,
                now: this.started_at,
            });

            let { value: caseValue, error: caseError } = schemaUpdate.validate(payload.case, { abortEarly: false });
            if (caseError) {
                return HttpResponse.validationsFail({
                    errors: caseError,
                    event: this.event,
                });
            }

            if (isAuxiliaryAuditOnlyPayload(payload)) {
                try {
                    await new CaseAuditTouch(this.repository, this.user).execute(
                        id,
                        {
                            updated_at: payload.case.updated_at,
                            updated_by: payload.case.updated_by,
                        },
                        { allowUpdateClosedCase: process.env.ALLOW_UPDATE_CLOSED_CASE === 'true' }
                    );
                } catch (error) {
                    if (error instanceof CustomError && error.statusCode === 404) {
                        return HttpResponse.notFound({ message: error.message, event: this.event });
                    }
                    if (error instanceof CustomError && error.statusCode === 403) {
                        return HttpResponse.forbidden({ message: error.message, event: this.event });
                    }
                    throw error;
                }
                return HttpResponse.ok({
                    data: CaseStaleSnapshotEvaluator.httpData([]),
                    event: this.event,
                });
            }

            if (!this.user?.isServiceAccount) {
                caseValue.edited_by = this.user.id.value;
                caseValue.edited_at = payload.case.updated_at;
            }

            if (payload.description) {
                payload.description.updated_at = this.started_at;
                payload.description.updated_by = this.user.id.value;
                const { error: descriptionError } = updateDescriptionSchema.validate(payload.description, {
                    abortEarly: false,
                });
                if (descriptionError) {
                    return HttpResponse.validationsFail({
                        errors: descriptionError,
                        event: this.event,
                    });
                }

                const lockGlobalConfig = await this.getGlobalConfig();
                if (isCaseDescriptionEditLocked(lockGlobalConfig)) {
                    throw new CaseDescriptionEditLockedError();
                }
            }

            const hasAuxiliaryData = Object.entries(payload.aux_cases).length > 0;

            let dataStructure;
            let removedMinNowPaths = [];

            if (hasAuxiliaryData) {
                payload.aux_cases.updated_at = this.started_at;
                payload.aux_cases.updated_by = this.user.id.value;
                const { value: auxValue, error: auxError } = auxiliaryUpdateSchema.validate(payload.aux_cases, {
                    abortEarly: false,
                });

                if (auxError) {
                    return HttpResponse.validationsFail({
                        errors: auxError,
                        event: this.event,
                    });
                }

                const auxDefinition = await this.#auxDefinitionTableNameFinder.execute(
                    this.auxiliaryRepository.tableName
                );

                const schema = await this.#schemaRules.execute(auxDefinition.schema_id.value);
                dataStructure = schema.toJson().data.data_structure;

                removedMinNowPaths = this.#removeMinNowFields(dataStructure);
                if (removedMinNowPaths.length > 0) {
                    Helper.logDebug(`Removed "min: now" from paths: ${removedMinNowPaths.join(', ')}`);
                }
            }

            if (caseValue.transicion_id) {
                await TransitionRuleValidator.enforceRuleForTransitionWithMergedContext(
                    caseValue.transicion_id,
                    this.transitionsCaseRepository,
                    this.transitionRuleRepository,
                    this.repository,
                    {
                        caseId: id,
                        contextOverrides: { ...payload, case: caseValue },
                    }
                );
            }

            const shouldOverrideArray = this.event.queryStringParameters?.override?.toLowerCase() ?? 'false';
            /*
             * The auxiliary is saved after the reclassification commits, so the folio has to be
             * built from what this request sends, not from the stored auxiliary: a radicado is
             * never regenerated.
             */
            const reclassResult = await applyAuxiliaryReclassification({
                caseId: id,
                caseValue,
                comment: payload.comment,
                reclassifier: this.#buildReclassifier(),
                caseFinder: new DomainCaseFinder(this.repository),
                pendingAuxData: hasAuxiliaryData ? payload.aux_cases.data : null,
                overrideAuxArrays: shouldOverrideArray === 'true',
            });
            caseValue = reclassResult.caseValue;

            if (caseValue.cliente_id) {
                await this.#ensureClientRelationship(caseValue.cliente_id);
            }
            if (caseValue.responsable_id) {
                await this.#ensureResponsableRelationship(caseValue.responsable_id);
            }
            if (caseValue.clasificacion_id) {
                await this.#ensureClasificationRelationship(caseValue.clasificacion_id);
            }
            if (caseValue.grupo_id) {
                await this.#ensureGroupRelationship(caseValue.grupo_id);
            }

            const {
                warnings: staleWarnings,
                persistedCase,
                responsableSnapshot,
                transitionSnapshot,
                clienteSnapshot,
                clasificacionSnapshot,
                grupoSnapshot,
            } = await CaseStaleSnapshotEvaluator.prepare({
                repository: this.repository,
                getGlobalConfig: () => this.getGlobalConfig(),
                caseId: id,
                caseValue,
            });
            payload.case = persistedCase;

            const allowUpdateClosedCase = process.env.ALLOW_UPDATE_CLOSED_CASE === 'true';

            if (hasAuxiliaryData) {
                await new AuxCasesUpdater(this.auxiliaryRepository, this.repository, this.user).execute(
                    payload.aux_cases,
                    payload.aux_cases.id,
                    dataStructure,
                    shouldOverrideArray === 'true',
                    removedMinNowPaths,
                    { allowUpdateClosedCase }
                );
            }

            if (payload.description) {
                const caseDescriptionUpdater = new CaseDescriptionUpdater(
                    this.descriptionRepository,
                    this.repository,
                    this.user
                );
                await caseDescriptionUpdater.execute(payload.description.id, payload.description);
            }

            const service = new CaseUpdater(
                this.repository,
                this.actionExecutionService,
                this.user,
                this.eventPublisher,
                this.tenant,
                this.transitionRuleRepository
            );
            const updateResult = await service.execute(id, persistedCase, true, {
                allowUpdateClosedCase,
                ...(reclassResult.applied ? { requiredPermission: CASE_RECLASSIFY_PERMISSION } : {}),
                responsableSnapshot,
                transitionSnapshot,
                clienteSnapshot,
                clasificacionSnapshot,
                grupoSnapshot,
            });
            CaseStaleSnapshotEvaluator.applyWriteOutcome(staleWarnings, persistedCase, updateResult);

            if (persistedCase.parent_id) {
                const parentUpdater = new ParentUpdater(this.auxiliaryRepository);
                await parentUpdater.execute(id, persistedCase.parent_id);
            }

            await this.fakeCaseUpdaterFactory(this.fakeCaseRepository).execute(id, {
                ...persistedCase,
                transicion_id: null,
            });

            return HttpResponse.ok({
                data: CaseStaleSnapshotEvaluator.httpData(staleWarnings),
                event: this.event,
            });
        } catch (error) {
            if (error instanceof ValidationFailError) {
                const fieldErrors =
                    Array.isArray(error.details) && error.details.length > 0
                        ? error.details.map((item) => ({
                              message: item.message,
                              path: Array.isArray(item.path) ? item.path.join('.') : item.path,
                          }))
                        : [{ message: error.message }];
                return HttpResponse.validationsFail({
                    message: error.message,
                    errors: fieldErrors,
                    event: this.event,
                    ...validationFailPublicFields(error),
                });
            }
            if (error instanceof CustomError) {
                const payload = { message: error.message, event: this.event, code: error.publicErrorCode };
                if (error.statusCode === 400) return HttpResponse.badRequest(payload);
                if (error.statusCode === 403) return HttpResponse.forbidden(payload);
                if (error.statusCode === 404) return HttpResponse.notFound(payload);
                if (error.statusCode === 409) return HttpResponse.conflict(payload);
            }
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionUpdate');
        }
    }

    #buildReclassifier() {
        const caseUpdater = new CaseUpdater(
            this.repository,
            this.actionExecutionService,
            this.user,
            this.eventPublisher,
            this.tenant
        );

        return new CaseReclassifier({
            caseRepository: this.repository,
            classificationsRepository: this.classificationsRepository,
            classificationGroupRelationshipRepository: this.classificationGroupRelationshipRepository,
            transitionsCaseRepository: this.transitionsCaseRepository,
            subcaseRelationshipRepository: this.subCasesRepository,
            getGlobalConfig: () => this.getGlobalConfig(),
            caseUpdater,
            commentsRepository: this.commentsRepository,
            /*
             * Same folio wiring as case_reclassify: reclassifying from the auxiliary edit must
             * give the case its folio too, or the radicado would depend on the endpoint used.
             */
            folioResolver: this.caseFolioResolver,
            auxCasesFinderByCase: new AuxCasesFinderByCase(this.auxiliaryRepository),
        });
    }

    async actionAdvanceSearch() {
        Helper.logInfo('Begin actionAdvanceSearch');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'users', 'UsersRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const payload = this.payload();
            const data = SearchSchema.validate(payload, { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            const userSearcher = new AdvancedSearch(this.repository);
            const response = await userSearcher.execute(data.value);

            return HttpResponse.ok({ ...response, event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionAdvanceSearch');
        }
    }

    /**
     * @returns {Promise<Response>}
     */
    async run() {
        try {
            this.user = await this.getLoggedInUser();
            return await this.#newActions();
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                message: error.message,
                event: this.event,
                errors: error,
            });
        } finally {
            await this.repository.destroyConnection();
        }
    }

    async runCognitoAuth() {
        try {
            return await this.#newActions();
        } finally {
            await this.repository.destroyConnection();
        }
    }

    /**
     * @returns {Promise<Response>}
     */
    async #newActions() {
        const resource = this.resource();
        const method = this.httpMethod();

        const resourceActions = {
            GET: {
                '/': this.actionIndex,
                '/{id}': this.actionRead,
                '/search': this.actionSearch,
            },
            POST: {
                '/': this.actionCreate,
                '/{id}': this.actionUpdate,
                '/{id}/delete': this.actionDelete,
                '/search': this.actionSearch,
                '/auxiliary': this.actionCreateWithAux,
                '/auxiliary/{id}': this.actionUpdateWithAux,
                '/advance-search': this.actionAdvanceSearch,
            },
        };

        const action = resourceActions[method]?.[resource];
        if (action) {
            return action.call(this);
        }

        if (method === 'GET' || method === 'POST') {
            return HttpResponse.notFound({
                message: `Resource not found: ${resource}`,
                event: this.event,
            });
        }

        return HttpResponse.methodNotAllowed({ event: this.event });
    }

    resource() {
        return this.event.resource;
    }

    async #validateForeignKeysExist({ clienteId, transicionId, responsableId, clasificacionId, grupoId }) {
        await ensureRelationshipsExist(this.repository.connection, (t) => this.repository.qualifiedName(t), {
            clienteId,
            transicionId,
            responsableId,
            clasificacionId,
            grupoId,
        });
    }

    async #ensureClientRelationship(clientId) {
        const client = await this.repository
            .connection(this.repository.qualifiedName('clients'))
            .select('id')
            .where({ id: clientId })
            .first();

        if (!client) {
            throw new CustomError(`Client with id ${clientId} does not exist.`, 404);
        }
    }

    async #ensureTransitionRelationship(transitionId) {
        const transitions = await this.repository
            .connection(this.repository.qualifiedName('transiciones'))
            .select('id')
            .where({ id: transitionId })
            .first();

        if (!transitions) {
            throw new CustomError(`Transition with id ${transitionId} does not exist.`, 404);
        }
    }

    async #ensureResponsableRelationship(responsableId) {
        const responsible = await this.repository
            .connection(this.repository.qualifiedName('usuarios'))
            .select('id')
            .where({ id: responsableId })
            .first();

        if (!responsible) {
            throw new CustomError(`Responsible with id ${responsableId} does not exist.`, 404);
        }
    }

    async #ensureClasificationRelationship(clasificationId) {
        const classification = await this.repository
            .connection(this.repository.qualifiedName('clasificaciones'))
            .select('id')
            .where({ id: clasificationId })
            .first();

        if (!classification) {
            throw new CustomError(`Clasification with id ${clasificationId} does not exist.`, 404);
        }
    }

    async #ensureGroupRelationship(groupId) {
        const group = await this.repository
            .connection(this.repository.qualifiedName('grupos'))
            .select('id')
            .where({ id: groupId })
            .first();

        if (!group) {
            throw new CustomError(`Group with id ${groupId} does not exist.`, 404);
        }
    }

    /**
     * Normalizes a path by removing "data_structure" segments
     * e.g., "form1.data_structure.updated_at" -> "form1.updated_at"
     */
    #normalizeDataPath = (path) => {
        if (!path) return path;
        return path
            .split('.')
            .filter((segment) => segment !== 'data_structure')
            .join('.');
    };

    #removeMinNowFields = (obj, path = '', isRoot = true) => {
        const results = [];

        if (obj === null || typeof obj !== 'object') {
            return results;
        }

        if (obj.min === 'now') {
            results.push(path || 'root');
            delete obj.min;
        }

        for (const key in obj) {
            if (Object.hasOwn(obj, key)) {
                const newPath = path ? `${path}.${key}` : key;
                results.push(...this.#removeMinNowFields(obj[key], newPath, false));
            }
        }

        // Normalize paths only at the root call to remove "data_structure" segments
        if (isRoot) {
            return results.map((p) => this.#normalizeDataPath(p));
        }

        return results;
    };
}

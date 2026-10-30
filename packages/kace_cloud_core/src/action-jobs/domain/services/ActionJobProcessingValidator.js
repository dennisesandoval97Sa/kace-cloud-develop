import { ActionJobProcessingCreator } from '../../../action-job-processing';
import { ActionTypes, DomainActionFinder } from '../../../actions';
import { DomainCaseFinder } from '../../../cases';
import { v4 as uuidV4, validate as isValidUUID } from 'uuid';
import { Aggregates, DomainActionUpdateModelFinder, Types } from '../../../action-update-model';
import { ValueObjectUuid, Criteria } from '../../../shared';
import { ValidationFailError } from '../../../shared/errors/ValidationFailError';

export class ActionJobProcessingValidator {
    /** @type {DomainCaseFinder} is initialized in the constructor */
    #caseFinder;
    /** @type {KnexClientRepository} is initialized in the constructor */
    #clientRepository;
    /** @type {DomainActionFinder} is initialized in the constructor */
    #actionFinder;
    /** @type {DomainActionUpdateModelFinder} is initialized in the constructor */
    #actionUpdateModelFinder;
    /** @type {ActionJobProcessingCreator} is initialized in the constructor */
    #actionExecutionCreator;
    /** @type {S3FileParser} is initialized in the constructor */
    #fileParser;
    /** @type {KnexWSRestFlowRepository} is initialized in the constructor */
    #wsRestflowRepository;

    /**
     * @param {KnexCaseRepository} caseRepository
     * @param {KnexClientRepository} clientRepository
     * @param {KnexActionRepository} actionRepository
     * @param {KnexActionJobProcessingRepository} actionExecutionRepository
     * @param {KnexActionUpdateModelRepository} actionUpdateModelRepository
     * @param {S3FileParser} fileParser
     * @param {KnexWSRestFlowRepository} wsRestflowRepository
     */
    constructor(
        caseRepository,
        clientRepository,
        actionRepository,
        actionExecutionRepository,
        actionUpdateModelRepository,
        fileParser,
        wsRestflowRepository
    ) {
        this.#caseFinder = new DomainCaseFinder(caseRepository);
        this.#clientRepository = clientRepository;
        this.#actionFinder = new DomainActionFinder(actionRepository);
        this.#actionUpdateModelFinder = new DomainActionUpdateModelFinder(actionUpdateModelRepository);
        this.#actionExecutionCreator = new ActionJobProcessingCreator(actionExecutionRepository);
        this.#fileParser = fileParser;
        this.#wsRestflowRepository = wsRestflowRepository;
    }

    async validateBatchFile({ id: jobId, s3_file_key, details, created_by, type = 'file_clients' }, save = false) {
        const errors = [];
        const records = await this.#loadFile(s3_file_key, details, errors);
        if (errors.length) return { processedCount: 0, errors };

        let processedCount = 0;
        let casesFailed = 0;

        for (const record of records) {
            processedCount++;

            const entityExists =
                type === 'file_clients'
                    ? await this.#checkClientExistence(record[0], record[1], processedCount, errors)
                    : await this.#checkCaseExistence(record[0], processedCount, errors);

            const { errorSavedCases } = await this.#processRecordActions({
                record,
                type,
                processedCount,
                entityExists,
                jobId,
                created_by,
                save,
                errors,
            });
            casesFailed += errorSavedCases;
        }
        return { processedCount, casesFailed, errors };
    }

    async saveFilteredResults({
        id: jobId,
        action_id,
        search_filter,
        created_by,
        restflow_id,
        type,
        evaluate_conditions,
    }) {
        const isClientFilter = type === 'filter_clients';

        if (isClientFilter && !restflow_id) {
            throw new ValidationFailError(
                'Para el tipo de filtro "filter_clients" debe proveerse un restflow_id',
                'restflow_id'
            );
        }

        let searchResults;
        if (isClientFilter) {
            /*
             * La tabla base es `clients`, no `aux_clients`: la ejecucion masiva actua sobre
             * clientes y el auxiliar es opcional. Con `aux_clients` como base, un cliente sin
             * fila auxiliar quedaba fuera del lote aunque el filtro fuera sobre columnas
             * nativas, y los filtros nativos (`clients.documento`) no resolvian. El filtro por
             * datos del auxiliar sigue siendo posible via `relationship` + `aux_clients.data`.
             */
            const criteria = new Criteria(
                search_filter.filter,
                search_filter.relationship,
                search_filter.limit,
                search_filter.offset,
                search_filter.order,
                'clients'
            );
            searchResults = await this.#clientRepository.search(criteria);
        } else {
            searchResults = await this.#caseFinder.executeByCriteria({ ...search_filter, offset: 0, limit: 0 });
        }

        if (!searchResults.length) {
            return {
                processedCount: 0,
                errors: [
                    `No se encontraron ${isClientFilter ? 'clientes' : 'casos'} que cumplan con los criterios de búsqueda.`,
                ],
            };
        }

        let action;
        if (restflow_id) {
            action = await this.#wsRestflowRepository.find(new ValueObjectUuid('restflow_id', restflow_id));
        } else {
            action = await this.#actionFinder.execute(action_id);
        }

        if (!action) {
            return {
                processedCount: 0,
                errors: [`No existe una acción/restflow con el id: ${action_id ?? restflow_id}`],
            };
        }

        let casesFailed = 0;
        const errors = [];
        for (const searchItem of searchResults) {
            try {
                /*
                 * En la rama de clientes `searchItem` ya es el cliente y `search()` descarta los
                 * borrados, asi que no hace falta releerlo: hacerlo costaba una consulta por
                 * cliente del lote sin aportar informacion.
                 */
                const itemExist = isClientFilter ? searchItem : await this.#caseFinder.execute(searchItem.id.value);

                if (!itemExist) {
                    errors.push(`Caso/cliente con ID ${searchItem.id.value} no existe.`);
                    continue;
                }

                const id = uuidV4();
                await this.#actionExecutionCreator.execute({
                    id,
                    job_id: jobId,
                    action_id: action_id ? action.id.value : null,
                    restflow_id: restflow_id ? action.id.value : null,
                    case_id: isClientFilter ? null : itemExist.id.value,
                    client_id: isClientFilter ? itemExist.id.value : null,
                    details: { attempts: 0 },
                    evaluate_conditions,
                    created_at: new Date().toISOString(),
                    created_by: created_by,
                });
            } catch (error) {
                // SI: Se guarda el error en el array de errores para posterior reporte, no es necesario log
                casesFailed++;
                errors.push(
                    `Error al guardar ejecución para el ${isClientFilter ? 'cliente' : 'caso'} con ID ${searchItem.id.value}: ${error}`
                );
            }
        }

        return {
            processedCount: searchResults.length,
            casesFailed,
            errors,
        };
    }

    async #processRecordActions({ record, type, processedCount, entityExists, jobId, created_by, save, errors }) {
        let errorSavedCases = 0;
        const startIndex = type === 'file_clients' ? 2 : 1;

        for (let i = startIndex; i < Object.values(record).length; i++) {
            const [actionIdentifier, actionContent] = record[i].split('|');
            const action = await this.#checkActionExistence(actionIdentifier, processedCount, errors);

            if (action) {
                this.#validateJsonContent(actionContent, processedCount, errors);

                if (type === 'file_clients') {
                    await this.#validateActionType(action, processedCount, errors);
                }

                if (entityExists && save) {
                    const result = await this.#saveExecution(action, entityExists, actionContent, {
                        jobId,
                        created_by,
                        save,
                        errors,
                        processedCount,
                        type,
                    });
                    !result && errorSavedCases++;
                }
            }
        }

        return { errorSavedCases };
    }

    async #loadFile(s3_file_key, details, errors) {
        let fileContent;
        try {
            fileContent = await this.#fileParser.readFile(s3_file_key);
        } catch (error) {
            // SI: Se guarda el error en el array de errores para posterior reporte, no es necesario log
            errors.push(`S3File: ${error.message}`);
            return [];
        }

        const records = await this.#fileParser.parseCSV(fileContent, details?.csv_config);
        if (!records.length) {
            errors.push('El archivo no contiene registros');
        }
        return records;
    }

    async #checkCaseExistence(caseId, processedCount, errors) {
        let caseExists;
        if (isValidUUID(caseId)) {
            caseExists = await this.#caseFinder.execute(caseId);
            if (!caseExists) {
                errors.push(`Registro ${processedCount}: No existe un caso con el UUID ${caseId}`);
            }
        } else if (Number.isInteger(parseInt(caseId)) && parseInt(caseId) > 0) {
            caseExists = await this.#caseFinder.executeByReference(+caseId);
            if (!caseExists) {
                errors.push(`Registro ${processedCount}: No existe un caso con el número de referencia ${caseId}`);
            }
        } else {
            errors.push(
                `Registro ${processedCount}: El ${caseId} no es válido. Debe ingresar el Id o la Referencia del caso`
            );
        }
        return caseExists;
    }

    async #checkClientExistence(tipoDocumento, documento, processedCount, errors) {
        try {
            const clientFound = await this.#clientRepository.findByIdentification(tipoDocumento, documento);
            if (!clientFound) {
                errors.push(
                    `Registro ${processedCount}: Cliente con documento ${tipoDocumento}:${documento} no encontrado.`
                );
            }
            return clientFound;
        } catch (error) {
            // SI: Se guarda el error en el array de errores para posterior reporte, no es necesario log
            errors.push(`Registro ${processedCount}: ${error.message}`);
            return null;
        }
    }

    async #checkActionExistence(actionIdentifier, processedCount, errors) {
        let action;
        if (isValidUUID(actionIdentifier)) {
            action = await this.#actionFinder.execute(actionIdentifier);
        } else {
            action = await this.#actionFinder.executeByDescription(actionIdentifier);
        }
        if (!action) {
            errors.push(`Registro ${processedCount}: No se encontró ninguna acción con el dato: ${actionIdentifier}`);
        }
        return action;
    }

    async #validateActionType(action, processedCount, errors) {
        if (action && action.action_type.value !== ActionTypes.ACTUALIZAR_MODELO.value) {
            errors.push(
                `Registro ${processedCount}: La acción con ID ${action.id.value} no es de un tipo válido "${ActionTypes.ACTUALIZAR_MODELO.value}"`
            );
        } else {
            const updateModelFound = await this.#actionUpdateModelFinder.execute(action.model_update_id.value);
            if (!updateModelFound) {
                errors.push(`Registro ${processedCount}: El updateModel con ID ${action.id.value} no se encontró."`);
            }
            if (![Aggregates.CLIENTES.value, Aggregates.AUX_CLIENT.value].includes(updateModelFound.aggregate.value)) {
                errors.push(
                    `Registro ${processedCount}: El updateModel no modifica una entidad válida "${Aggregates.CLIENTES.value}" o "${Aggregates.AUX_CLIENT.value}"`
                );
            }
            if (updateModelFound.type.value === Types.FORMULA.value) {
                errors.push(`Registro ${processedCount}: No hay sopore para las actualizaciones tipo formula"`);
            }
        }
    }

    #validateJsonContent(content, processedCount, errors) {
        if (content) {
            try {
                JSON.parse(content);
            } catch {
                // SI: error al parsear JSON no afecta el flujo, se guarda en 'errors' para ser reportado al usuario.
                // SI: Se guarda el error en el array de errores para posterior reporte, no es necesario log
                errors.push(`Registro ${processedCount}: Error al convertir los datos, no es JSON válido: ${content}`);
            }
        }
    }

    async #saveExecution(action, entity, actionContent, extras = {}) {
        try {
            const dto = {
                id: uuidV4(),
                job_id: extras.jobId,
                action_id: action.id.value,
                [extras.type === 'file_clients' ? 'client_id' : 'case_id']: entity.id.value,
                details: { attempts: 0, content: actionContent },
                created_at: new Date().toISOString(),
                created_by: extras.created_by,
            };
            await this.#actionExecutionCreator.execute(dto);
            return true;
        } catch (error) {
            // SI: Se guarda el error en el array de errores para posterior reporte, no es necesario log
            extras.errors.push(
                `Registro ${extras.processedCount}: Error al cargar la ejecución para el ${extras.type === 'file_clients' ? 'cliente' : 'caso'} ${entity.id.value}: ${error}`
            );
            return false;
        }
    }
}

import { KnexS3ImportFiles } from '../../infrastructure/persistence/KnexS3ImportFiles.js';
import { KnexUsersRepository } from '../../../users/index.js';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { EmailService, Mail } from '../../../mails/index.js';
import { CsvValueNormalizer } from '../../domain/services/CsvValueNormalizer.js';
import { CsvParserService } from '../../infrastructure/csv/CsvParserService.js';
import { CsvRecordProcessorService } from '../../domain/services/CsvRecordProcessorService.js';
import { usersCsvContentValidator } from '../../domain/services/usersCsvContentValidator.js';
import { usersCsvFileStructureValidator } from '../../domain/services/usersCsvFileStructureValidator.js';
import { KnexSecretsVaultRepository } from '../../../secrets-vault/infrastructure/persistence/KnexSecretsVaultRepository.js';
import SchemaBuilder from '@kace/schemabuilder/src/SchemaBuilder.js';
import { KnexAuxDefinitionsRepository } from '@kace/core/src/aux_definitions/infrastructure/persitance/KnexAuxDefinitionsRepository';
import { AuxDefinitionTableNameFinder } from '@kace/core/src/aux_definitions/domain/AuxDefinitionTableNameFinder';
import { KnexSchemasRepository } from '@kace/core/src/schemas/infrastructure/persistence/KnexSchemasRepository';
import { SchemaRules } from '@kace/core/src/schemas/application/rules/SchemaRules';
import { KnexAuxiliariesRepository } from '../../../auxiliaries/infrastructure/persistence/KnexAuxiliariesRepository.js';
import { buildAuxJsonFromCsv } from '../../../shared/domain/utilities/processAuxiliaryData.js';
import { checkUniqueFields } from '../../../shared/domain/services/checkUniqueFields.js';
import {
    SchemaConversionsApplier,
    TEXT_SOURCE_ADOPTABLE_TYPES,
} from '../../../shared/domain/services/SchemaConversionsApplier.js';
import { TenantContext, ValueObjectUuid } from '../../../shared/index.js';
import { KnexBackgroundExecutionRepository } from '../../../background-executions/infrastructure/persistence/KnexBackgroundExecutionRepository.js';
import { BackgroundExecutionService } from '../../../shared/domain/services/background-execution/BackgroundExecutionService.js';
import { BackgroundProcessEnum } from '../../../shared/domain/enum/BackgroundProcessEnum.js';

export class S3ImportsProcessor {
    static MIN_SAFE_TIME_FOR_NEXT_IMPORT_MS = 10_000;

    /** @type {KnexS3ImportFiles} is initialized in the constructor */
    #repository;
    /** @type {KnexUsersRepository} is initialized in the constructor */
    #usersRepository;
    /** @type {S3Client} is initialized in the constructor */
    #s3Client;
    /** @type {string} is initialized in the constructor */
    #bucket;
    /** @type {EmailService} is initialized in the constructor */
    #emailService;
    /** @type {KnexAuxDefinitionsRepository} */
    #auxDefinitionsRepository;
    /** @type {AuxDefinitionTableNameFinder} */
    #auxDefinitionTableNameFinder;
    /** @type {KnexSchemasRepository} */
    #schemasRepository;
    /** @type {KnexAuxiliariesRepository} */
    #auxiliariesRepository;
    /** @type {SchemaRules} */
    #schemaRules;
    /** @type {KnexBackgroundExecutionRepository} */
    #backgroundExecutionRepository;
    /** @type {BackgroundExecutionService} */
    #backgroundExecutionService;
    /** @type {function(): number} is initialized in the constructor */
    #remainingTimeMs;
    /** @type {string} is initialized in the constructor */
    #executionOwnerId;
    /** @type {number} is initialized in the constructor */
    #initialExecutionWindowMs;

    constructor(remainingTimeMs = () => Infinity) {
        this.#remainingTimeMs = remainingTimeMs;
        this.#executionOwnerId = ValueObjectUuid.random();
        const knexConfig = TenantContext.buildKnexConfig();
        this.#repository = new KnexS3ImportFiles(knexConfig);
        this.#usersRepository = new KnexUsersRepository(this.#repository.connection);
        const tenant = TenantContext.getTenant();
        const currentRemainingTimeMs = this.#remainingTimeMs();
        this.#initialExecutionWindowMs =
            Number.isFinite(currentRemainingTimeMs) && currentRemainingTimeMs > 0 ? currentRemainingTimeMs : Infinity;
        this.#s3Client = new S3Client({
            region: tenant.aws_s3_region.value,
            credentials: {
                accessKeyId: tenant.aws_s3_access_key_id.value,
                secretAccessKey: tenant.aws_s3_secret_access_key.value,
            },
        });
        this.#bucket = tenant.aws_s3_bucket.value;
        this.#emailService = new EmailService(new KnexSecretsVaultRepository(this.#repository.connection));
        this.#auxDefinitionsRepository = new KnexAuxDefinitionsRepository(this.#repository.connection);
        this.#auxDefinitionTableNameFinder = new AuxDefinitionTableNameFinder(this.#auxDefinitionsRepository);
        this.#schemasRepository = new KnexSchemasRepository(this.#repository.connection);
        this.#auxiliariesRepository = new KnexAuxiliariesRepository(this.#repository.connection);
        this.#schemaRules = new SchemaRules(this.#schemasRepository);
        this.#backgroundExecutionRepository = new KnexBackgroundExecutionRepository(this.#repository.connection);
        this.#backgroundExecutionService = new BackgroundExecutionService(this.#backgroundExecutionRepository);
    }

    async processPendingsImports() {
        Helper.logInfo('Iniciando processPendingsImports');
        let processActivatedByThis = false;
        let skipped = null;

        try {
            if (await this.#isAlreadyRunning()) {
                Helper.logInfo('Process currently running, skipping processPendingsImports...');
                return { skipped: 'locked' };
            }

            await this.#markBackgroundProcess(true);
            processActivatedByThis = true;

            let hasNextImport = true;

            while (hasNextImport) {
                if (!this.#hasTimeToProcessNextImport()) {
                    Helper.logInfo('Stopping imports processing due to low remaining Lambda time.');
                    skipped = 'time';
                    break;
                }

                hasNextImport = await this.#processNextImport();

                if (hasNextImport) {
                    try {
                        await this.#markBackgroundProcess(true);
                    } catch (error) {
                        Helper.logError(
                            'Kicking out of process loop: Error during lease renewal (heartbeat), likely a DB issue.',
                            error
                        );
                        break;
                    }
                }
            }
            // SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
            //TODO: Pendiente garantizara a futuro el procesamiento multihilo de archivos
            return { skipped };
        } catch (error) {
            Helper.logError('Critical error in imports processing:', error);
            throw error;
        } finally {
            if (processActivatedByThis) {
                await this.#releaseBackgroundProcess();
            }
            Helper.logInfo('Finalizando processPendingsImports');
        }
    }

    /**
     * Determina si hay tiempo suficiente para iniciar otro archivo sin arriesgar timeout forzado.
     *
     * @returns {boolean}
     */
    #hasTimeToProcessNextImport() {
        const remainingTimeMs = this.#remainingTimeMs();
        if (!Number.isFinite(remainingTimeMs)) {
            return true;
        }

        return remainingTimeMs > S3ImportsProcessor.MIN_SAFE_TIME_FOR_NEXT_IMPORT_MS;
    }

    /**
     * Define el timeout para considerar el lock de ejecución como stale.
     *
     * @returns {number} timeout en minutos
     */
    #getStaleTimeoutMinutes() {
        return Math.ceil(this.#initialExecutionWindowMs / 60_000) + 1;
    }

    /**
     * Verifies if the processor is already running
     *
     * @returns {Promise<boolean>} True if a process is already running, false otherwise
     */
    async #isAlreadyRunning() {
        const backgroundExecution = await this.#getBackgroundExecution();

        if (backgroundExecution && backgroundExecution.isRunning()) {
            const staleTimeoutMinutes = this.#getStaleTimeoutMinutes();

            if (backgroundExecution.isStale(staleTimeoutMinutes)) {
                Helper.logInfo(
                    `Background process found in running state but stale (>${staleTimeoutMinutes} mins). A new execution will take over.`
                );
                return false;
            }

            return true;
        }

        return false;
    }

    /**
     * Gets the background execution object for this process
     *
     * @returns {Promise<BackgroundExecution|null>} Background execution object or null if it doesn't exist
     */
    async #getBackgroundExecution() {
        return this.#backgroundExecutionService.findBackgroundExecution(BackgroundProcessEnum.IMPORTS_PROCESSOR.value);
    }

    /**
     * Marks the execution process according to the provided status
     *
     * @param {Boolean} status - Process status (running or not) -> True for running, false for not running
     *
     * @returns {Promise<void>}
     */
    async #markBackgroundProcess(status) {
        await this.#backgroundExecutionService.updateBackgroundExecution(
            BackgroundProcessEnum.IMPORTS_PROCESSOR.value,
            {
                execution_status: status,
                updated_by: this.#executionOwnerId,
                updated_at: new Date(),
            }
        );
    }

    async #releaseBackgroundProcess() {
        const backgroundExecution = await this.#getBackgroundExecution();

        if (!backgroundExecution) {
            return;
        }

        if (backgroundExecution.updated_by?.value !== this.#executionOwnerId) {
            Helper.logInfo('Skipping background release because current execution is not the lock owner.');
            return;
        }

        await this.#backgroundExecutionService.updateBackgroundExecution(
            BackgroundProcessEnum.IMPORTS_PROCESSOR.value,
            {
                execution_status: false,
                updated_by: this.#executionOwnerId,
                updated_at: new Date(),
            }
        );
    }

    async #processNextImport() {
        const fileRecord = await this.#repository.findFileToProcess();
        if (!fileRecord) {
            Helper.logInfo('No pending files to process.');
            return false;
        }

        const mailAccount = await this.#repository.getNotificationsConfig(fileRecord.created_by.value);
        const userToNotify = await this.#repository.findUserToNotify(fileRecord.created_by.value);

        const currentDate = new Date().toISOString();

        try {
            if (fileRecord.upload_attempts.value >= 5) {
                throw new Error('Rejected process file by number of attempts');
            }

            await this.#repository.updateImport(fileRecord.id.value, {
                status: 'processing',
                last_updated_at: new Date(),
            });

            const fileData = await this.#getCSVData(`${this.#bucket}/${fileRecord.file_path.value}`);
            if (fileData === null || fileData === undefined) throw new Error('Failed to download CSV file');

            const csvContent = await CsvParserService.parse(fileData);
            let records = csvContent;
            let dataStructure = null;
            const isDeleteAction = fileRecord.action_type?.value === 'DELETE';

            if (csvContent.length === 0) {
                await this.#repository.updateImport(fileRecord.id.value, {
                    status: 'rejected',
                    error_details: 'Archivo vacio (No se encontraron registros para insertar)',
                    last_updated_at: new Date(),
                });
                if (mailAccount) {
                    await this.#notifyUser(userToNotify, mailAccount, fileRecord, currentDate, 'rejected');
                }
                return true;
            }

            if (!isDeleteAction && fileRecord.target_table.value === 'usuarios') {
                const structureValidationResult = usersCsvFileStructureValidator.execute(csvContent);
                if (structureValidationResult.length > 0) {
                    const structureValidationErrors = structureValidationResult.slice(0, 20).join(', ');
                    await this.#repository.updateImport(fileRecord.id.value, {
                        status: 'rejected',
                        error_details: structureValidationErrors,
                        last_updated_at: new Date(),
                    });
                    if (mailAccount) {
                        await this.#notifyUser(userToNotify, mailAccount, fileRecord, currentDate, 'rejected');
                    }
                    return true;
                }

                const dataValidation = await usersCsvContentValidator.validate(csvContent, this.#repository);
                if (!dataValidation.isValid) {
                    await this.#repository.updateImport(fileRecord.id.value, {
                        status: 'rejected',
                        error_details: dataValidation.summary,
                        last_updated_at: new Date(),
                    });
                    if (mailAccount) {
                        await this.#notifyUser(userToNotify, mailAccount, fileRecord, currentDate, 'rejected');
                    }
                    return true;
                }
            }
            if (!isDeleteAction && fileRecord.target_table.value.startsWith('aux_')) {
                const auxDefinition = await this.#auxDefinitionTableNameFinder.execute(fileRecord.target_table.value);

                const schema = await this.#schemaRules.execute(auxDefinition.schema_id.value);
                dataStructure = schema.toJson().data.data_structure;

                const auxJsonRecords = buildAuxJsonFromCsv(csvContent, dataStructure);

                const joiBuilderValidation = await SchemaBuilder.build(dataStructure);

                const errors = [];
                const normalizedAuxRecords = [];

                const joiMessagesEs = {
                    'any.required': '{{#label}} es obligatorio',
                    'any.only': '{{#label}} debe ser uno de los valores permitidos',
                    'string.base': '{{#label}} debe ser texto',
                    'string.empty': '{{#label}} no puede estar vacío',
                    'string.min': '{{#label}} debe tener al menos {{#limit}} caracteres',
                    'string.max': '{{#label}} no puede superar {{#limit}} caracteres',
                    'string.email': '{{#label}} debe ser un correo electrónico válido',
                    'string.uri': '{{#label}} debe ser una URL válida',
                    'string.pattern.base': '{{#label}} no tiene el formato correcto',
                    'string.isoDate': '{{#label}} debe ser una fecha válida en formato ISO',
                    'number.base': '{{#label}} debe ser un número',
                    'number.integer': '{{#label}} debe ser un número entero',
                    'number.positive': '{{#label}} debe ser un número positivo',
                    'number.negative': '{{#label}} debe ser un número negativo',
                    'number.min': '{{#label}} debe ser mayor o igual a {{#limit}}',
                    'number.max': '{{#label}} debe ser menor o igual a {{#limit}}',
                    'number.greater': '{{#label}} debe ser mayor a {{#limit}}',
                    'number.less': '{{#label}} debe ser menor a {{#limit}}',
                    'boolean.base': '{{#label}} debe ser verdadero o falso',
                    'date.base': '{{#label}} debe ser una fecha válida',
                    'array.base': '{{#label}} debe ser una lista',
                    'array.min': '{{#label}} debe tener al menos {{#limit}} elementos',
                    'array.max': '{{#label}} no puede tener más de {{#limit}} elementos',
                };

                auxJsonRecords.forEach((record, index) => {
                    const { id, ...dataWithoutId } = record;
                    const rowNumber = index + 2;

                    if (id && !ValueObjectUuid.isValidUuid(id)) {
                        errors.push(`Fila ${rowNumber}: "id" debe ser un UUID válido`);
                        return;
                    }

                    const valueData = joiBuilderValidation.validate(dataWithoutId, {
                        abortEarly: false,
                        messages: joiMessagesEs,
                    });

                    if (valueData.error) {
                        errors.push(`Fila ${rowNumber}: ${valueData.error.message}`);
                    } else if (Object.keys(valueData.value).length === 0) {
                        errors.push(`Fila ${rowNumber}: el registro no contiene datos`);
                    } else {
                        // El CSV llega sin tipar, así que esta importación sí necesita la coerción
                        // de Joi (`"41"` -> `41`) y los `default` del esquema para las celdas
                        // vacías; pero adoptar el documento convertido completo reescribiría las
                        // fechas en una forma que ya no pasa su propio esquema.
                        normalizedAuxRecords.push({
                            id,
                            ...SchemaConversionsApplier.execute({
                                target: dataWithoutId,
                                converted: valueData.value,
                                dataStructure,
                                adoptableTypes: TEXT_SOURCE_ADOPTABLE_TYPES,
                                materializeDefaults: true,
                            }),
                        });
                    }
                });

                if (errors.length > 0) {
                    await this.#repository.updateImport(fileRecord.id.value, {
                        status: 'rejected',
                        error_details: errors.slice(0, 20).join('; '),
                        last_updated_at: new Date(),
                    });
                    if (mailAccount) {
                        await this.#notifyUser(userToNotify, mailAccount, fileRecord, currentDate, 'rejected');
                    }
                    return true;
                }
                const dbErrors = [];
                for (const [index, record] of normalizedAuxRecords.entries()) {
                    const { id, ...data } = record;
                    const rowNumber = index + 2;
                    const violations = await checkUniqueFields(
                        dataStructure,
                        data,
                        this.#auxiliariesRepository,
                        fileRecord.target_table.value,
                        { id }
                    );
                    if (violations.length > 0) {
                        const detail = violations.map((v) => `${v.path} ("${v.value}")`).join(', ');
                        dbErrors.push(`Fila ${rowNumber}: campo(s) único(s) duplicado(s) en BD: ${detail}`);
                    }
                }
                if (dbErrors.length > 0) {
                    await this.#repository.updateImport(fileRecord.id.value, {
                        status: 'rejected',
                        error_details: dbErrors.slice(0, 20).join('; '),
                        last_updated_at: new Date(),
                    });
                    if (mailAccount) {
                        await this.#notifyUser(userToNotify, mailAccount, fileRecord, currentDate, 'rejected');
                    }
                    return true;
                }

                records = normalizedAuxRecords;
            }

            const processResult = await CsvRecordProcessorService.execute(
                records,
                fileRecord,
                this.#repository,
                CsvValueNormalizer.normalize,
                this.#usersRepository,
                this.#auxiliariesRepository,
                dataStructure,
                fileRecord.should_override_array?.value ?? false
            );

            if (mailAccount) {
                await this.#notifyUser(userToNotify, mailAccount, fileRecord, currentDate, processResult.status);
            }
        } catch (error) {
            // SI: Se reportan los errores en el dashboard de imports, no es necesario log
            const attempts = fileRecord.upload_attempts.value;
            const updatedDetails = fileRecord.error_details?.value
                ? `${fileRecord.error_details.value.generalErrors},${error.message}`
                : error.message;

            const updateData = {
                upload_attempts: attempts + 1,
                status: attempts >= 5 ? 'rejected' : 'failed',
                error_details: updatedDetails,
                last_updated_at: new Date(),
            };

            await this.#repository.updateImport(fileRecord.id.value, updateData);

            if (attempts >= 5 && mailAccount) {
                await this.#notifyUser(userToNotify, mailAccount, fileRecord, currentDate, 'rejected');
            }
        }

        return true;
    }

    async #getCSVData(filePath) {
        const [bucket, ...fileKey] = filePath.split('/');
        try {
            const command = new GetObjectCommand({ Bucket: bucket, Key: fileKey.join('/') });
            const response = await this.#s3Client.send(command);

            const streamToString = (stream) =>
                new Promise((resolve, reject) => {
                    let data = '';
                    stream.setEncoding('utf-8');
                    stream.on('data', (chunk) => (data += chunk));
                    stream.on('end', () => resolve(data));
                    stream.on('error', reject);
                });

            return await streamToString(response.Body);
        } catch (error) {
            Helper.logError(error);
            throw new Error(`Error downloading S3-CSV file: ${error}`);
        }
    }

    async #notifyUser(user, mailAccount, fileRecord, processedAt, status) {
        const fileName = fileRecord.file_path.value.split('/').pop();
        const titleMap = {
            completed: 'Tu archivo se cargó correctamente',
            incompleted: 'Tu archivo se cargó de forma parcial',
            rejected: 'Tu archivo presentó un error de carga',
            failed: 'Tu archivo presentó un error de carga',
        };

        const contentMap = {
            completed: 'se cargó satisfactoriamente',
            incompleted: 'presentó una carga parcial',
            rejected: 'no pudo ser cargado correctamente',
            failed: 'no pudo ser cargado correctamente',
        };

        const notifyConfig = {
            id: mailAccount.id.value,
            mail_account_id: mailAccount.id.value,
            to: [user.email.value],
            subject: `Tu archivo ${fileName} terminó de procesarse`,
            content: `${titleMap[status]}<br>Hola ${user.nombres.value}, desde Kace te informamos que los datos de "${fileRecord.target_table.value}" cargados en el archivo <b>${fileName}</b> el día ${fileRecord.created_at.value} fueron procesados el día ${processedAt} y <b>${contentMap[status]}</b>.`,
            sent_status: 'PENDING',
            created_at: fileRecord.created_at.value,
            created_by: fileRecord.created_by.value,
        };

        const mail = Mail.create(notifyConfig);
        await this.#emailService.execute(mail, mailAccount);
    }

    async destroy() {
        if (this.#repository?.connection?.destroy) {
            await this.#repository.connection.destroy();
        }
    }
}

import { Helper, ValidationFailError } from '../../../shared';
import { AuxCases } from '../../domain/AuxCases';
import { AuxCaseResponse } from '../AuxCaseResponse';
import AutoCalculatedFields from '../../../shared/domain/services/AutoCalculatedFields.js';
import { VODataStructure } from '../../../schemas/domain/VODataStructure.js';
import { EventLogger } from '../../../shared/EventLogger.js';
import { checkUniqueFields } from '../../../shared/domain/services/checkUniqueFields.js';

export class AuxCasesCreator {
    /**
     * @type {import('../../infrastructure/persitance/KnexAuxCasesRepository').KnexAuxCasesRepository} repository
     * is initialized in the constructor
     */
    #repository;

    /**
     *
     * @param {KnexAuxCasesRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.eventLogger = new EventLogger(repository);
    }

    /**
     *
     * @param {object} dto
     * @param {object} dataStructure
     * @param {import('knex').Knex.Transaction} [trx] - optional transaction; when provided the
     *   aux INSERT + history run on the transactional connection so they are atomic with the
     *   caller's case/description writes. Validation reads and the best-effort eventLogger.log
     *   intentionally stay on the repository's own connection.
     * @return {Promise<AuxCaseResponse>}
     */
    async execute(dto, dataStructure, trx) {
        const auxCases = AuxCases.create(dto);

        if (dataStructure && Object.keys(dataStructure).length > 0) {
            const voDataStructure = new VODataStructure(dataStructure);
            const valuesCalculated = new AutoCalculatedFields(auxCases, voDataStructure);
            const calculated = valuesCalculated.execute('create');

            for (const [formId, fieldsCalculated] of Object.entries(calculated)) {
                if (!auxCases.data.value[formId]) auxCases.data.value[formId] = {};
                Object.assign(auxCases.data.value[formId], fieldsCalculated);
            }

            const violations = await checkUniqueFields(
                dataStructure,
                auxCases.data.value,
                this.#repository,
                this.#repository.tableName,
                null
            );
            if (violations.length > 0) {
                throw new ValidationFailError(
                    `Duplicate value for unique field(s): ${violations.map((v) => `${v.path} ("${v.value}")`).join(', ')}`,
                    violations[0].path,
                    violations
                );
            }
        }

        if (dto.external_code) {
            const existingByCode = await this.#repository.findByCaseExternalCode(dto.external_code);
            if (existingByCode) {
                throw new ValidationFailError(`External code ${dto.external_code} already exists`, 'external_code');
            }
        }

        const result = await this.#repository.findByCaseId(auxCases.caso_id);
        if (result) {
            throw new ValidationFailError(`AuxCase with case id ${auxCases.caso_id.value} already exists`, 'caso_id');
        }

        const newRecord = await this.#repository.save(auxCases, trx);
        await this.#repository.saveHistoryWithRelationships(auxCases, null, auxCases.caso_id, trx);

        try {
            await this.eventLogger.log(
                'aux-cases.updated',
                auxCases.id.value,
                auxCases.created_by.value,
                dto,
                auxCases.caso_id.value,
                dto?.cliente_id,
                {}
            );
        } catch (error) {
            Helper.logError('Error registering eventLog: ', error);
        }

        return new AuxCaseResponse(newRecord);
    }
}

import SchemaBuilder from '@kace/schemabuilder/src/SchemaBuilder.js';
import { CustomError } from '../../../shared/errors/CustomError';
import { DomainAuxCasesFinder } from '../../index.js';
import { CanUpdateCase, Helper, ValidationFailError } from '../../../shared/index.js';
import { DomainCaseFinder } from '../../../cases/index.js';
import { EventLogger } from '../../../shared/EventLogger.js';
import AutoCalculatedFields from '../../../shared/domain/services/AutoCalculatedFields.js';
import { VODataStructure } from '../../../schemas/domain/VODataStructure.js';
import { checkUniqueFields } from '../../../shared/domain/services/checkUniqueFields.js';
import { NestedValueManager } from '../../../shared/domain/utilities/NestedValueManager.js';
import { ComparisonService } from '../../../shared/domain/services/ComparisonService.js';
import { DeepMergeAuxiliariesData } from '../../../shared/domain/services/DeepMergeAuxiliariesData.js';
import { SchemaConversionsApplier } from '../../../shared/domain/services/SchemaConversionsApplier.js';
import { AuxiliaryDataInvalidError } from '../../domain/AuxiliaryDataInvalidError.js';

const getValueByPath = (obj, path) => {
    if (!obj || !path) return undefined;
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
};

const parseDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
};

/**
 * Joi `any.required` on a merge-then-validate update: keep the error only when
 * the persisted document already had that path. A sparse patch must not punch a
 * hole in a required field that was present; a legacy document that never had
 * the field stays editable. Every other Joi type still blocks.
 *
 * @param {import('joi').ValidationErrorItem[]} details
 * @param {object} persisted Pre-merge auxiliary `data`
 * @returns {import('joi').ValidationErrorItem[]}
 */
function detailsBlockingMerge(details, persisted) {
    return (details ?? []).filter((detail) => {
        if (detail?.type !== 'any.required') {
            return true;
        }
        return getValueByPath(persisted, (detail.path ?? []).join('.')) !== undefined;
    });
}

// updated_at/updated_by are set unconditionally by AuxCases.update(); rewriting the row
// just to bump them is exactly the redundant-write signature this guard eliminates.
// deleted_at/deleted_by are currently unreachable here (execute() throws on soft-delete dtos
// before this guard), but excluding them keeps the guard robust if that ordering ever changes.
const AUDIT_KEYS = ['id', 'created_at', 'created_by', 'updated_at', 'updated_by', 'deleted_at', 'deleted_by'];

const hasEffectiveChanges = (originalValues, nextValues) => {
    const project = (values) => {
        const projection = { ...values };
        for (const key of AUDIT_KEYS) delete projection[key];
        return projection;
    };
    return !ComparisonService.deepEqual(project(originalValues), project(nextValues));
};

export class AuxCasesUpdater {
    /**
     * @param {AuxCasesFinder}
     * is initialized in the constructor
     */
    #finder;

    /**
     * @param {KnexAuxCasesRepository}
     * is initialized in the constructor
     */
    #repository;

    /** @type {DomainCaseFinder} is initialized in the constructor */
    #caseFinder;

    /** @type {import('../../../users').User} is initialized in the constructor */
    #user;

    /**
     *
     * @param {KnexAuxCasesRepository} repository
     * @param caseRepository
     * @param user
     */
    constructor(repository, caseRepository, user) {
        this.#finder = new DomainAuxCasesFinder(repository);
        this.#caseFinder = new DomainCaseFinder(caseRepository);
        this.#repository = repository;
        this.#user = user;
        this.eventLogger = new EventLogger(repository);
    }

    /**
     *
     * @param {object} dto Object data for update
     * @param {string} id record identificator for update
     * @param {object} dataStructure
     * @param {Boolean} shouldOverrideArray
     * @param {string[]} removedMinNowPaths Paths where "min: now" was removed, to validate date changes
     * @param {{allowUpdateClosedCase?: boolean}} [options] When allowUpdateClosedCase is true, bypasses the
     * resolved-case guard so aux data can still be updated after the case is closed.
     */
    async execute(
        dto,
        id,
        dataStructure,
        shouldOverrideArray = false,
        removedMinNowPaths = [],
        { allowUpdateClosedCase = false } = {}
    ) {
        const auxCase = await this.#finder.execute(id);

        if (!auxCase) {
            Helper.logError('Aux case not found', id);
            throw new CustomError('Aux case you try update does not exist', 404);
        }

        if (removedMinNowPaths.length > 0) {
            const now = new Date();
            const errors = [];

            for (const path of removedMinNowPaths) {
                const currentValue = getValueByPath(auxCase.data.value, path);
                const newValue = getValueByPath(dto.data, path);
                if (newValue !== undefined && newValue !== currentValue) {
                    const newDate = parseDate(newValue);

                    if (newDate && newDate < now) {
                        errors.push({
                            path,
                            message: `El campo "${path}" no puede tener una fecha menor a la fecha actual`,
                        });
                    }
                }
            }

            if (errors.length > 0) {
                throw new AuxiliaryDataInvalidError(
                    errors.map((e) => e.message).join('; '),
                    errors.map((e) => ({ path: e.path, reason: 'past_date' }))
                );
            }
        }

        const kase = await this.#caseFinder.execute(auxCase.caso_id.value);
        if (this.#user && kase && !CanUpdateCase.check(this.#user, kase)) {
            Helper.logError('is not allowed to update case', this.#user.id, kase.id);
            throw new CustomError('You do not have permission to update this case', 403);
        }
        if (kase.fecha_resolucion?.value && !allowUpdateClosedCase) {
            Helper.logInfo('is resolved', kase.fecha_resolucion.value);
            throw new CustomError('The case is already resolved; updates are not allowed.', 403);
        }

        if (dto.deleted_at || dto.deleted_by) {
            Helper.logError('is deleted', dto.deleted_at, dto.deleted_by);
            throw new ValidationFailError('El auxiliar no puede ser eliminado', 'dto.deleted');
        }

        let mergedForWrite = null;
        if (dataStructure && Object.keys(dataStructure).length > 0) {
            mergedForWrite = DeepMergeAuxiliariesData.execute(auxCase.data.value, dto.data ?? {}, shouldOverrideArray);
            const { error, value: convertedForWrite } = SchemaBuilder.build(dataStructure).validate(mergedForWrite, {
                abortEarly: false,
                allowUnknown: true,
                context: { isUpdate: true },
            });
            if (error) {
                const details = detailsBlockingMerge(
                    SchemaBuilder.dropUntouchedNestedErrors(
                        error.details,
                        dataStructure,
                        dto.data ?? {},
                        auxCase.data.value,
                        shouldOverrideArray
                    ),
                    auxCase.data.value
                );
                if (details.length > 0) {
                    throw AuxiliaryDataInvalidError.fromJoi(details[0].message ?? error.message, details);
                }
            }

            // The document is validated whole (a sparse patch must still be legal against the
            // full structure) but only the patched string leaves inherit Joi's conversion:
            // adopting the converted document wholesale would rewrite dates and materialize
            // defaults on keys the request never sent.
            mergedForWrite = SchemaConversionsApplier.execute({
                target: mergedForWrite,
                converted: convertedForWrite,
                dataStructure,
                patch: dto.data ?? {},
                errorDetails: error?.details,
            });
        }

        const originalValues = auxCase.toJson();
        if (mergedForWrite) {
            auxCase.updateRaw({
                data: mergedForWrite,
                updated_at: dto.updated_at,
                updated_by: dto.updated_by,
            });
        } else {
            auxCase.update(dto, shouldOverrideArray);
        }

        if (dataStructure && Object.keys(dataStructure).length > 0) {
            const voDataStructure = new VODataStructure(dataStructure);
            const valuesCalculated = new AutoCalculatedFields(auxCase, voDataStructure);
            const calculated = valuesCalculated.execute('update');

            const updatedData = { ...auxCase.data.value };

            for (const [formId, fieldsCalculated] of Object.entries(calculated)) {
                if (!updatedData[formId]) updatedData[formId] = {};
                updatedData[formId] = { ...updatedData[formId], ...fieldsCalculated };
            }

            auxCase.data = updatedData;

            const violations = await checkUniqueFields(
                dataStructure,
                updatedData,
                this.#repository,
                this.#repository.tableName,
                { id: auxCase.id.value }
            );
            if (violations.length > 0) {
                throw new AuxiliaryDataInvalidError(
                    `Duplicate value for unique field(s): ${violations.map((v) => `${v.path} ("${v.value}")`).join(', ')}`,
                    violations.map((v) => ({ path: v.path, reason: 'duplicate' })),
                    { duplicateFields: violations }
                );
            }
        }

        const nextValues = auxCase.toJson();
        if (!hasEffectiveChanges(originalValues, nextValues)) {
            Helper.logInfo('AuxCasesUpdater.execute noop: no effective changes, skipping persistence', id);
            auxCase.flushChanges();
            return;
        }

        await this.#repository.update(auxCase);
        await this.#repository.saveHistoryWithRelationships(auxCase, originalValues, auxCase.caso_id);

        try {
            await this.eventLogger.log(
                'aux-cases.updated',
                id,
                auxCase.updated_by.value,
                dto,
                auxCase.caso_id.value,
                kase?.cliente_id.value,
                originalValues
            );
        } catch (error) {
            Helper.logError('Error registering eventLog: ', error);
        }
        auxCase.flushChanges();
    }

    /**
     * Executes a partial JSON update using database jsonb_set to prevent overwriting concurrent updates.
     * @param {Array<{path: string, value: any}>} updates
     * @param {string} id
     * @param {string} id
     */
    async executeJsonbUpdates(updates, id) {
        if (!updates || updates.length === 0) return;

        const auxCase = await this.#finder.execute(id);

        if (!auxCase) {
            Helper.logError('Aux case not found', id);
            throw new CustomError('Aux case you try update does not exist', 404);
        }

        const kase = await this.#caseFinder.execute(auxCase.caso_id.value);
        if (this.#user && kase && !CanUpdateCase.check(this.#user, kase)) {
            Helper.logError('is not allowed to update case', this.#user.id, kase.id);
            throw new CustomError('You do not have permission to update this case', 403);
        }
        if (kase.fecha_resolucion?.value) {
            Helper.logInfo('is resolved', kase.fecha_resolucion.value);
            throw new CustomError('The case is already resolved; updates are not allowed.', 403);
        }

        const originalValues = auxCase.toJson();
        let updatedData = JSON.parse(JSON.stringify(auxCase.data.value || {}));

        for (const { path, value } of updates) {
            NestedValueManager.setValue(updatedData, path, value);
        }

        auxCase.data = updatedData;

        await this.#repository.updateDataFields(auxCase.id, auxCase.caso_id.value, updates);

        await this.#repository.saveHistoryWithRelationships(auxCase, originalValues, auxCase.caso_id);

        try {
            await this.eventLogger.log(
                'aux-cases.updated',
                id,
                auxCase.updated_by.value,
                { data: updatedData },
                auxCase.caso_id.value,
                kase?.cliente_id.value,
                originalValues
            );
        } catch (error) {
            Helper.logError('Error registering eventLog: ', error);
        }
        auxCase.flushChanges();
    }
}

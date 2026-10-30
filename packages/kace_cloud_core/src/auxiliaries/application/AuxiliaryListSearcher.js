import { ValidateEntityExists } from '../domain/ValidateEntityExists.js';
import { KnexAuxiliariesRepository } from '../infrastructure/persistence/KnexAuxiliariesRepository.js';
import { AuxiliaryListCollectionResponse } from './AuxiliaryListCollectionResponse.js';
import { Criteria, Helper } from '../../shared/index.js';
import { ValidationFailError } from '../../shared/index.js';

export class AuxiliaryListSearcher {
    /** @type {KnexAuxiliariesRepository} */
    #repository;
    /** @type {ValidateEntityExists} */
    #validateEntityExists;

    /**
     * @param {KnexAuxiliariesRepository} repository - Repositorio para operaciones de auxiliares
     */
    constructor(repository) {
        this.#repository = repository;
        this.#validateEntityExists = new ValidateEntityExists(repository);
    }

    /**
     * Busca AuxDefinitions según los criterios dados y retorna una colección estándar.
     * @returns {Promise<AuxiliaryListCollectionResponse>} Los registros encontrados y el total
     * @throws {ValidationFailError} Si la tabla no existe
     */
    async execute(tableName, fieldPath, criteriaParams = {}) {
        Helper.logTime('AuxiliaryListSearcher::ValidateEntityExists::execute');
        await this.#validateEntityExists.execute(tableName);
        Helper.logTimeEnd('AuxiliaryListSearcher::ValidateEntityExists::execute');

        const defaults = {
            filter: undefined,
            relationship: undefined,
            limit: 0,
            offset: 0,
            order: { field: 'created_at', direction: 'desc' },
        };

        const merged = {
            ...defaults,
            ...criteriaParams,
            order: criteriaParams.order ?? defaults.order,
        };

        const criteria = new Criteria(
            merged.filter,
            merged.relationship,
            merged.limit,
            merged.offset,
            merged.order,
            tableName
        );

        Helper.logTime('AuxiliaryListSearcher::RepositorySearch::execute');
        const rows = await this.#repository.search(criteria, tableName);
        Helper.logTimeEnd('AuxiliaryListSearcher::RepositorySearch::execute');

        const isPrimitive = (v) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';

        Helper.logTime('AuxiliaryListSearcher::rawItems');
        const rawItems = rows.map((row) => {
            const base = row?.toJson?.()?.data;
            return this.#extractByPath(base, fieldPath);
        });
        Helper.logTimeEnd('AuxiliaryListSearcher::rawItems');

        if (fieldPath) {
            Helper.logTime('AuxiliaryListSearcher::fieldPath');
            const nonNull = rawItems.filter((v) => v !== null && v !== undefined);

            const hasNonPrimitive = nonNull.some((v) => !isPrimitive(v));

            if (hasNonPrimitive) {
                throw new ValidationFailError(
                    `Field path "${fieldPath}" must resolve to a primitive value`,
                    'queryStringParameter'
                );
            }
            Helper.logTimeEnd('AuxiliaryListSearcher::fieldPath');
        }

        const filtered = fieldPath ? rawItems.filter((v) => v !== null && v !== undefined) : rawItems;

        const seen = new Set();
        const items = fieldPath
            ? filtered.filter((v) => {
                  if (!isPrimitive(v)) return true;
                  if (seen.has(v)) return false;
                  seen.add(v);
                  return true;
              })
            : filtered;

        return new AuxiliaryListCollectionResponse(items, items.length);
    }

    #extractByPath(obj, fieldPath) {
        if (!fieldPath) return obj;
        return fieldPath.split('.').reduce((acc, key) => {
            if (acc == null) return undefined;
            return typeof acc === 'object' ? acc[key] : undefined;
        }, obj);
    }
}

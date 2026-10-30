import { Criteria, ValidationFailError } from '../../shared';
import { AUX_EXPORT_NO_RECORDS } from '@kace/error-codes';
import { CSVStorage } from '../domain/CSVStorage';
import { flattenAuxRow, generateHeadersFromSchema } from '../../shared/domain/utilities/processAuxiliaryData';
import { AuxDefinitionTableNameFinder } from '../../aux_definitions/domain/AuxDefinitionTableNameFinder';
import { KnexAuxDefinitionsRepository } from '../../aux_definitions/infrastructure/persitance/KnexAuxDefinitionsRepository';
import { KnexSchemasRepository } from '../../schemas/infrastructure/persistence/KnexSchemasRepository';
import { SchemaRules } from '@kace/core/src/schemas/application/rules/SchemaRules';

export class ExportAuxTableData {
    #repository;
    #storage;
    #auxDefinitionTableNameFinder;
    #auxDefinitionsRepository;
    #schemasRepository;
    #schemaRules;

    constructor(repository) {
        this.#repository = repository;
        this.#storage = new CSVStorage();
        this.#auxDefinitionsRepository = new KnexAuxDefinitionsRepository(this.#repository.connection);
        this.#schemasRepository = new KnexSchemasRepository(this.#repository.connection);
        this.#auxDefinitionTableNameFinder = new AuxDefinitionTableNameFinder(this.#auxDefinitionsRepository);
        this.#schemaRules = new SchemaRules(this.#schemasRepository);
    }

    async execute({ tableName, headers = [], criteria }) {
        if (!criteria) {
            criteria = { limit: 0, offset: 0 };
        }

        const baseFilter = Array.isArray(criteria.filter) ? [...criteria.filter] : [];
        baseFilter.push({
            field: 'deleted_at',
            operator: 'null',
            value: 'null',
            type: 'AND',
        });

        criteria = {
            ...criteria,
            filter: baseFilter,
        };

        const hasDataHeader = headers.includes('data');

        const aggregateCriteria = new Criteria(
            criteria.filter,
            criteria.relationships,
            criteria.limit,
            criteria.offset,
            criteria.order,
            tableName
        );

        let dbHeaders = headers;

        if (!hasDataHeader) {
            const data = await this.#repository.getData(tableName, dbHeaders, aggregateCriteria);

            if (!data || data.length === 0) {
                throw new ValidationFailError(
                    `No se encontraron registros en "${tableName}" que coincidan con el criterio de búsqueda.`,
                    'criteria',
                    [],
                    AUX_EXPORT_NO_RECORDS
                );
            }

            const fileUrl = await this.#storage.save(tableName, data);
            const downloadUrl = await this.#storage.getDownloadUrl(fileUrl);

            return { downloadUrl };
        }

        const rawRows = await this.#repository.getData(tableName, dbHeaders, aggregateCriteria);

        if (!rawRows || rawRows.length === 0) {
            throw new ValidationFailError(
                `No se encontraron registros en "${tableName}" que coincidan con el criterio de búsqueda.`,
                'criteria',
                [],
                AUX_EXPORT_NO_RECORDS
            );
        }

        const auxDefinition = await this.#auxDefinitionTableNameFinder.execute(tableName);
        const schema = await this.#schemaRules.execute(auxDefinition.schema_id.value);
        const dataStructure = schema.toJson().data.data_structure;

        const flattenedRows = [];
        for (const row of rawRows) {
            const rowsForEntity = flattenAuxRow(row, headers, dataStructure);
            flattenedRows.push(...rowsForEntity);
        }

        const allHeaders = new Set();
        for (const row of flattenedRows) {
            Object.keys(row).forEach((key) => allHeaders.add(key));
        }

        const schemaHeaders = generateHeadersFromSchema(dataStructure);
        schemaHeaders.forEach((h) => allHeaders.add(h));

        const sortedHeaders = Array.from(allHeaders).sort((a, b) => {
            if (a === 'id') return -1;
            if (b === 'id') return 1;
            const aHasColon = a.includes('::');
            const bHasColon = b.includes('::');
            if (aHasColon && !bHasColon) return 1;
            if (!aHasColon && bHasColon) return -1;
            return a.localeCompare(b);
        });

        const normalizedRows = flattenedRows.map((row) => {
            const normalized = {};
            for (const header of sortedHeaders) {
                normalized[header] = row[header] !== undefined ? row[header] : '';
            }
            return normalized;
        });

        const fileUrl = await this.#storage.save(tableName, normalizedRows);
        const downloadUrl = await this.#storage.getDownloadUrl(fileUrl);

        return { downloadUrl };
    }
}

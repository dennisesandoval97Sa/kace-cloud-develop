import { ValueObjectString } from '../domain/value-object/ValueObjectString';
import { ValidationFailError } from '../errors/ValidationFailError';
import { blacklistFields } from '../../../config/BlacklistField';

export class FilterField extends ValueObjectString {
    constructor(value, tablename = null) {
        const isAuxiliary = tablename && (value.startsWith('aux_') || value.startsWith('aux-') || value.includes('case_auxiliar') || value.includes('clients_auxiliar')) &&
            tablename !== 'aux_definitions'

        if ((value.match(/\./g) || []).length > 1 && !isAuxiliary) {
            throw new ValidationFailError(
                `Invalid filter format. Expected 'table.column' or 'column' only. ${value}`,
                `filterField`
            );
        } else if (!value.match(/\./g)) {
            throw new ValidationFailError(
                `Invalid filter format. Expected columns in format 'table.column' or 'column' only. ${value}`,
                `filterField`
            );
        }

        let table;
        let column;

        if (value.includes('.')) {
            const parts = value.split('.');
            table = parts[0];
            column = parts[1];
        } else {
            if (!tablename) {
                throw new ValidationFailError(
                    "Table name is required when column doesn't include table reference.",
                    'filterField'
                );
            }
            table = tablename;
            column = value;
        }

        if (!table || table.trim() === '') {
            throw new ValidationFailError('Table name cannot be null or empty', 'filterField');
        }

        if (!column || column.trim() === '') {
            throw new ValidationFailError('Column name cannot be null or empty', 'filterField');
        }

        if (blacklistFields[table]) {
            if (blacklistFields[table].includes(column)) {
                throw new ValidationFailError(`Restricted column name: ${column} for table ${table}`, 'filterField');
            }
        }

        super('field filter', value);
    }
}

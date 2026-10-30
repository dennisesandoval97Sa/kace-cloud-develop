import { InvalidArgumentError } from '../errors/InvalidArgumentError.js';
import { ValueObject } from '../domain/value-object/ValueObject.js';
import { Guards } from '../domain/guards/Guards.js';
import { ValueObjectString } from '../domain/value-object/ValueObjectString.js';
import { ValueObjectJson } from '../domain/value-object/ValueObjectJson.js';
import { ALLOWED_CRITERIA_FUNCTIONS } from './allowedCriteriaFunctions.js';

export class VOSelectByCriteria extends ValueObject {
    constructor(field, value, nullable = false, allowedTables = []) {
        super(field, value);

        if (!nullable && !value) {
            throw new InvalidArgumentError(`${this.field}: The value cannot be null`);
        }

        if (nullable && !value) return;

        Guards.arrayType(this);

        if (value && value.length === 0 && !nullable) {
            throw new Error(`${this.field}: The array cannot be empty`);
        }

        this.validateSelectColumns(value, allowedTables);
    }

    validateSelectColumns(value, allowedTables) {
        const validTables = new Set(allowedTables);
        value.forEach((column) => {
            if (typeof column === 'object') {
                // SONAR-EXC: Instancia para validar, no se almacena
                new ValueObjectJson(this.field, column);
                this.#validateColumnFunctionStructure(column);
                this.#validateFunction(column.function);
                return;
            }
            // SONAR-EXC: Instancia para validar, no se almacena
            new ValueObjectString(this.field, column);
            const [table] = column.split('.');
            if (table === '*') return;
            const field = column.split('.')[1].split(' as ')[0];
            const unPrivateFields = this.getPrivateFields();
            if (unPrivateFields.includes(field)) {
                throw new InvalidArgumentError(`${this.field}: The field '${field}' is not a valid select field`);
            }

            if (!validTables.has(table)) {
                throw new InvalidArgumentError(
                    `${this.field}: The table '${table}' is not part of the allowed relationships (${[...validTables].join(', ')})`
                );
            }
        });
    }

    getPrivateFields() {
        return [
            'password_reset_token',
            'login',
            'client_secret',
            'token',
            'vault',
            'nivel3',
            'refresh_token',
            'encryption',
            'access_token',
            'vault_data',
            'secreto',
            'cognito_hash_data',
        ];
    }

    #validateFunction(functionName) {
        const isAggregate = !!ALLOWED_CRITERIA_FUNCTIONS.aggregate_functions[functionName.toUpperCase()];
        const isComparison = !!ALLOWED_CRITERIA_FUNCTIONS.compartion_functions[functionName.toUpperCase()];
        const isConcat = !!ALLOWED_CRITERIA_FUNCTIONS.concat_functions[functionName.toUpperCase()];
        if (!isAggregate && !isComparison && !isConcat) {
            throw new InvalidArgumentError(
                `${this.field}: The function '${functionName}' is not allowed. Allowed functions: ${Object.values(ALLOWED_CRITERIA_FUNCTIONS.aggregate_functions).join(', ')}, ${Object.values(ALLOWED_CRITERIA_FUNCTIONS.compartion_functions).join(', ')} and ${Object.values(ALLOWED_CRITERIA_FUNCTIONS.concat_functions).join(', ')}`
            );
        }
    }

    #validateColumnFunctionStructure(column) {
        const requiredProps = ['function', 'alias', 'field'];

        for (const prop of requiredProps) {
            if (!column[prop]) {
                throw new InvalidArgumentError(
                    `${this.field}: The object structure is invalid. Missing required property: ${prop}`
                );
            }
        }

        const columnProps = Object.keys(column);
        const extraProps = columnProps.filter((p) => !requiredProps.includes(p));

        if (extraProps.length > 0) {
            throw new InvalidArgumentError(
                `${this.field}: The object contains invalid extra properties: ${extraProps.join(', ')}`
            );
        }
    }
}

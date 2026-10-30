import { ValidationFailError } from '../../shared';
import { SchemaFunctionsService } from '../application/functions/SchemaFunctionsService';

export class FormulaFunctionsValidator {
    static allowedFunctions = FormulaFunctionsValidator.#extractAllowedFunctions();

    static #extractAllowedFunctions() {
        const { data } = new SchemaFunctionsService().getAll();
        return Object.values(data)
            .flat()
            .map((f) => f.name);
    }

    /**
     * Valida que las funciones y los campos usados en la fórmula sean válidos.
     * @param {string} formula
     * @param {Object} dataStructure
     * @throws {ValidationFailError}
     */
    static validate(formula, dataStructure) {
        if (typeof formula !== 'string') {
            throw new ValidationFailError('calc.formula must be a string');
        }

        const functionPattern = /\b([a-zA-Z_]\w*)\s*\(/g;
        let match;
        while ((match = functionPattern.exec(formula)) !== null) {
            const funcName = match[1];
            if (!this.allowedFunctions.includes(funcName)) {
                throw new ValidationFailError(`Invalid function "${funcName}" in formula`);
            }
        }

        const refPattern = /ref\s*\(\s*["']([\w-]+)["']\s*\)/g;
        while ((match = refPattern.exec(formula)) !== null) {
            const fieldName = match[1];

            const structure = dataStructure?.value || dataStructure;

            if (!Object.prototype.hasOwnProperty.call(structure, fieldName)) {
                throw new ValidationFailError(`Invalid field reference "${fieldName}" in formula`);
            }
        }
    }

    static validateParams(functionName, args) {
        const { data } = new SchemaFunctionsService().getAll();
        const allFuncs = Object.values(data).flat();
        const funcSchema = allFuncs.find((f) => f.name === functionName);

        if (!funcSchema) throw new ValidationFailError(`Function "${functionName}" not found`);

        const expectedParams = funcSchema.params || [];
        if (!funcSchema.params.some((p) => p.variadic)) {
            if (args.length !== expectedParams.length) {
                throw new ValidationFailError(
                    `Function "${functionName}" expects ${expectedParams.length} arguments but got ${args.length}`
                );
            }
        }
    }
}

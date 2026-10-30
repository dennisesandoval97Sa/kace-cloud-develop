import axios from 'axios';
import { Helper } from '../index';

export class OneScriptValidationsHandler {
    async getValidationsData(url) {
        let oneScriptData = null;

        try {
            oneScriptData = await axios(url);
        } catch (error) {
            Helper.logError(error);
            throw Error(`Message: 'One-script get validations fail'; Error: ${error}`);
        }

        if (!oneScriptData || oneScriptData.status !== 200) {
            throw Error(`Message: invalid status on one-script`);
        }

        const schemaData = oneScriptData.data.schemaData;

        let validations = [];
        let stackComponents = [];

        if (schemaData.components) {
            stackComponents.push(...schemaData.components);
        }

        while (stackComponents.length > 0) {
            let current = stackComponents.pop();

            if (current.columns) {
                current.columns.forEach((component) => {
                    component.components.forEach((field) => {
                        validations.push({ key: field.key, label: field.label, validate: field.validate });
                    });
                });
            }

            if (current.components) {
                stackComponents.push(...current.components);
            }
        }

        return validations;
    }

    validations(payload, validations) {
        validations.forEach((validation) => {
            const validateItem = payload[validation.key];
            const validateRules = validation.validate;

            if (!validateItem) {
                throw Error(`Failed one script validation: validateItem is ${validateItem}`);
            }

            if (validateRules.required && (!validateItem || validateItem === '')) {
                throw Error(`Failed one script validation: ${validateItem} is required`);
            }

            if (
                (validateItem.length < validateRules.minLength &&
                    validateRules.minLength &&
                    validateRules.minLength !== '') ||
                (validateItem.length > validateRules.maxLength &&
                    validateRules.maxLength &&
                    validateRules.maxLength !== '')
            ) {
                throw Error(`Failed one script validation: ${validateItem} doesn't have the required length`);
            }

            const regex = new RegExp(validateRules.pattern);

            if (validateRules.pattern && validateRules.pattern !== '' && !regex.test(validateItem)) {
                throw Error(`Failed one script validation: ${validateItem} doesn't not match with the required format`);
            }
        });

        return true;
    }
}

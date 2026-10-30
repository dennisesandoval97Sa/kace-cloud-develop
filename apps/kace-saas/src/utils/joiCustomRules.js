import { isStringSecure } from "../utils/security/securityGuards.js";
import cron from "cron-validate";

/**
 * Devuelve una función personalizada para validar contenido inseguro en un string
 * @param {string} message - Mensaje de error personalizado (default: "Texto inseguro detectado.")
 * @returns {Function} - Función compatible con Joi.custom
 */
export const secureCustomRule = (message = "Texto inseguro detectado.") => {
    return (value, helpers) => {
        if (!isStringSecure(value)) {
            return helpers.message(message);
        }
        return value;
    };
};

/**
 * A reusable Joi custom rule to check for characters often used in XSS attacks.
 * This version is self-contained and uses a specific i18n key for errors.
 *
 * @returns {Function} A Joi custom validation function.
 */
export const safeString = () => {
    return (value, helpers) => {
        const dangerousChars = /[<>()"'{};]/;

        if (dangerousChars.test(value)) {
            return helpers.error("validations.string.secure");
        }

        return value;
    };
};

/**
 * A reusable Joi custom rule to validate a crontab string.
 * This version uses the 'cron-validate' library instead of a React hook.
 *
 * @returns {Function} A Joi custom validation function.
 */
export const crontab = () => {
    return (value, helpers) => {
        // Validate a standard 5-part cron expression (minute, hour, day of month, month, day of week).
        if (!cron(value).isValid()) {
            return helpers.message("string.crontab");
        }
        return value;
    };
};

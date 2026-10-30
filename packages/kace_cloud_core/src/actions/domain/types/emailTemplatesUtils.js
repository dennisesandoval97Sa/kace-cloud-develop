// La lógica de plantillas de correo vive ahora en una ubicación compartida para que tanto el
// camino de acciones (SMTP) como el de envío por Channel Hub (emails) la reutilicen sin acoplarse.
export {
    buildEmailTemplateContext,
    replaceTemplateVariables,
    parseEmailList,
    renderEmailsOrFail,
} from '../../../shared/domain/services/emailTemplating/emailTemplatesUtils.js';

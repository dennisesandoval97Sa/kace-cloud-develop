import { globalRoleIdZeroTrust, globalSystemUserId } from '@kace/database/seeds/20241125105900_usuario_base.js';
import { TenantContext } from '../../infrastructure/context/TenantContext.js';
import { DomainError } from '../../errors/DomainError.js';

export class Parameters {
    constructor() {}

    static oneScriptUrlApi = (uuid) =>
        `https://api.konecta.cloud/onescript/prd/v1/schema/${uuid}/render?version=latest&stage=dev`;
    static mailAuthorityUrl = (tenant_id) => `https://login.microsoftonline.com/${tenant_id}/oauth2/v2.0/token`;
    static mailAuthScope = 'https://graph.microsoft.com/.default';
    static defaultRoleId = globalRoleIdZeroTrust;
    static defaultUserId = globalSystemUserId;
    static cognitoUrl = () => {
        if (!TenantContext.isInContext()) {
            throw new DomainError('Tenant is not loaded', 500);
        }
        return TenantContext.getTenant()?.aws_cognito_url?.value;
    };
    static oneScriptUrlReferer = 'https://onescript.konecta.cloud/';
}

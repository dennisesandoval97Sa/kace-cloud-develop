import { AxiosHttpClient } from '../../../shared/infrastructure/http/AxiosHttpClient';
import { KnexAllowedConnectionsRepository } from '../../../allowed-conections';
import { Helper, TenantContext } from '../../../shared';
import { Parameters } from '../../../shared/domain/params/Parameters';

export const revokeToken = async (clientId, refreshToken) => {
    const knexConfig = TenantContext.buildKnexConfig();
    const allowedConnectionRepository = new KnexAllowedConnectionsRepository(knexConfig);
    const httpClient = new AxiosHttpClient(allowedConnectionRepository);

    const configuration = {
        client_id: clientId,
        token: refreshToken,
    };

    const formData = new URLSearchParams(configuration).toString();

    try {
        const revokeRequest = await httpClient.request({
            method: 'POST',
            url: `${Parameters.cognitoUrl()}/oauth2/revoke`,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            data: formData,
        });
        Helper.logDebug('Token revoked successfully in Cognito.', {
            status: revokeRequest.status,
            data: revokeRequest.data,
        });
    } catch (error) {
        Helper.logError('Error revoking the token.', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
        });
        const err = new Error(
            `Error revoking token: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`
        );
        err.cause = error;
        throw err;
    }
};

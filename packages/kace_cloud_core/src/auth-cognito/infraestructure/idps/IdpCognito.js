import { CognitoIdentityProviderClient, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';
import { Idp } from '../../domain/Idp.js';
import { CustomError, Helper } from '../../../shared/index.js';

export class IdpCognito extends Idp {
    #config; // is initialized in the constructor

    /** @type {CognitoIdentityProviderClient} is initialized in the constructor */
    #cognito;

    constructor(config) {
        super();
        this.#ensureValidConfig(config);
        this.#config = config;
        this.#cognito = new CognitoIdentityProviderClient({ region: config.region });
    }

    #ensureValidConfig(config) {
        if (!config.clientId) {
            Helper.logError('IdpCognito: clientId is required');
            throw new CustomError('InvalidConfig', 500);
        }
        if (!config.region) {
            Helper.logError('IdpCognito: region is required');
            throw new CustomError('InvalidConfig', 500);
        }
    }

    async authenticate(serviceAccount) {
        const params = {
            AuthFlow: 'USER_PASSWORD_AUTH',
            ClientId: this.#config.clientId,
            AuthParameters: {
                USERNAME: serviceAccount.username,
                PASSWORD: serviceAccount.password,
            },
        };

        try {
            const response = await this.#cognito.send(new InitiateAuthCommand(params));
            return response.AuthenticationResult;
        } catch (error) {
            Helper.logError(`IdpCognito authentication error: ${error.message}`, error);
            throw new CustomError('Incorrect username or password', 500);
        }
    }
}

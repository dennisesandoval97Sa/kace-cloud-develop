import { awsJson } from '../aws.mjs';
import { AbortedError } from '../errors.mjs';

/**
 * update-user-pool-client REEMPLAZA la configuración entera: un campo omitido vuelve
 * a su valor por defecto (scopes, flows, IdPs, validez de tokens) y rompe el login.
 * Por eso se reenvía TODO lo que devuelve describe salvo estos campos de solo lectura.
 * Denylist a propósito: si AWS añade un campo de solo lectura nuevo, la CLI falla
 * ruidosamente; con una allowlist, un campo actualizable nuevo se resetearía en silencio.
 */
export const READ_ONLY_CLIENT_FIELDS = Object.freeze(['CreationDate', 'LastModifiedDate', 'ClientSecret']);

const REQUIRED_KEYS = [
    'AWS_COGNITO_USER_POOL_ID',
    'AWS_COGNITO_APP_CLIENT_ID',
    'VITE_COGNITO_REDIRECT_URI_PROD',
    'VITE_COGNITO_LOGOUT_URI_PROD',
];

export function missingUrls(current = [], wanted = []) {
    return wanted.filter((url) => url && !current.includes(url));
}

export function buildUpdateInput(client, { callback, logout }) {
    const input = Object.fromEntries(
        Object.entries(client).filter(([field]) => !READ_ONLY_CLIENT_FIELDS.includes(field))
    );
    input.CallbackURLs = [...(client.CallbackURLs || []), ...callback];
    input.LogoutURLs = [...(client.LogoutURLs || []), ...logout];
    return input;
}

async function loadState(ctx) {
    const missingKeys = REQUIRED_KEYS.filter((key) => !ctx.env[key]);
    if (missingKeys.length) {
        throw new Error(`Faltan variables para Cognito: ${missingKeys.join(', ')}`);
    }
    const region = ctx.env.AWS_COGNITO_REGION || ctx.region;
    const data = await awsJson(
        ctx,
        [
            'cognito-idp',
            'describe-user-pool-client',
            '--user-pool-id',
            ctx.env.AWS_COGNITO_USER_POOL_ID,
            '--client-id',
            ctx.env.AWS_COGNITO_APP_CLIENT_ID,
        ],
        { region }
    );
    const client = data.UserPoolClient;
    return {
        region,
        client,
        callback: missingUrls(client.CallbackURLs, [ctx.env.VITE_COGNITO_REDIRECT_URI_PROD]),
        logout: missingUrls(client.LogoutURLs, [ctx.env.VITE_COGNITO_LOGOUT_URI_PROD]),
    };
}

export function describeUrlChanges(state) {
    return [
        `App client ${state.client.ClientName || state.client.ClientId}:`,
        ...state.callback.map((url) => `+ CallbackURLs ${url}`),
        ...state.logout.map((url) => `+ LogoutURLs ${url}`),
    ];
}

export const cognitoClient = {
    name: 'cognito-client',
    async isDone(ctx) {
        const state = await loadState(ctx);
        return !state.callback.length && !state.logout.length;
    },
    async plan(ctx) {
        return describeUrlChanges(await loadState(ctx));
    },
    async run(ctx) {
        const state = await loadState(ctx);
        ctx.write(`${describeUrlChanges(state).join('\n')}\n`);
        if (!ctx.flags.yes && !(await ctx.confirm('¿Añadir estas URLs al app client de Cognito?'))) {
            throw new AbortedError('Cambio en Cognito cancelado por el usuario.');
        }
        const input = buildUpdateInput(state.client, state);
        await awsJson(ctx, ['cognito-idp', 'update-user-pool-client', '--cli-input-json', JSON.stringify(input)], {
            region: state.region,
        });
    },
};

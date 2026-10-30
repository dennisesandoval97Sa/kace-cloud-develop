import { readFileSync, writeFileSync } from 'node:fs';
import { CognitoIdentityProviderClient, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';

const DEFAULT_THRESHOLD_MS = 15 * 60 * 1000;

export function isExpiringSoon(token, thresholdMs = DEFAULT_THRESHOLD_MS) {
    return token.expiresAt - Date.now() <= thresholdMs;
}

export async function refreshIfNeeded(tokens, refresher, thresholdMs = DEFAULT_THRESHOLD_MS) {
    const result = [];
    for (const token of tokens) {
        if (isExpiringSoon(token, thresholdMs)) {
            result.push(await refresher(token));
        } else {
            result.push(token);
        }
    }
    return result;
}

async function refreshOne(token, { client, clientId }) {
    const command = new InitiateAuthCommand({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: clientId,
        AuthParameters: { REFRESH_TOKEN: token.refreshToken },
    });
    const response = await client.send(command);
    const r = response.AuthenticationResult;
    return {
        ...token,
        idToken: r.IdToken,
        expiresAt: Date.now() + (r.ExpiresIn ?? 3600) * 1000,
    };
}

async function runCli() {
    const tokensPath = process.env.PERF_TOKENS_OUTPUT ?? './auth/tokens.local.json';
    const region = process.env.PERF_COGNITO_REGION;
    const clientId = process.env.PERF_COGNITO_CLIENT_ID;
    const thresholdMs = Number(process.env.PERF_TOKEN_REFRESH_THRESHOLD_MS ?? DEFAULT_THRESHOLD_MS);

    if (!region || !clientId) {
        console.error('PERF_COGNITO_REGION and PERF_COGNITO_CLIENT_ID must be set.');
        process.exit(1);
    }

    const tokens = JSON.parse(readFileSync(tokensPath, 'utf8'));
    const client = new CognitoIdentityProviderClient({ region });

    const refreshed = await refreshIfNeeded(tokens, (t) => refreshOne(t, { client, clientId }), thresholdMs);
    writeFileSync(tokensPath, JSON.stringify(refreshed, null, 4));
    const refreshedCount = refreshed.filter((t, i) => t.idToken !== tokens[i].idToken).length;
    console.error(`Refreshed ${refreshedCount}/${tokens.length} tokens.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    await runCli();
}

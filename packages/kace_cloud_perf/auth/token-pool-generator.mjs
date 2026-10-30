import { readFileSync, writeFileSync } from 'node:fs';
import { CognitoIdentityProviderClient, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';

export async function authenticateUser({ client, clientId, username, password }) {
    const command = new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: clientId,
        AuthParameters: {
            USERNAME: username,
            PASSWORD: password,
        },
    });
    const response = await client.send(command);
    if (!response.AuthenticationResult) {
        throw new Error(`no AuthenticationResult for ${username}`);
    }
    const { IdToken, RefreshToken, ExpiresIn } = response.AuthenticationResult;
    return {
        username,
        idToken: IdToken,
        refreshToken: RefreshToken,
        expiresAt: Date.now() + (ExpiresIn ?? 3600) * 1000,
    };
}

export async function generatePool({ client, clientId, users }) {
    const tokens = [];
    for (const user of users) {
        // Sequential to avoid hitting Cognito throttling on first run.
        const token = await authenticateUser({
            client,
            clientId,
            username: user.username,
            password: user.password,
        });
        tokens.push(token);
    }
    return tokens;
}

async function runCli() {
    const region = process.env.PERF_COGNITO_REGION;
    const clientId = process.env.PERF_COGNITO_CLIENT_ID;
    const usersFile = process.env.PERF_TEST_USERS_FILE ?? './auth/test-users.local.json';
    const outputPath = process.env.PERF_TOKENS_OUTPUT ?? './auth/tokens.local.json';

    if (!region || !clientId) {
        console.error('PERF_COGNITO_REGION and PERF_COGNITO_CLIENT_ID must be set.');
        process.exit(1);
    }

    const users = JSON.parse(readFileSync(usersFile, 'utf8'));
    const client = new CognitoIdentityProviderClient({ region });

    console.error(`Generating tokens for ${users.length} users (region=${region})...`);
    const tokens = await generatePool({ client, clientId, users });
    writeFileSync(outputPath, JSON.stringify(tokens, null, 4));
    console.error(`Wrote ${tokens.length} tokens to ${outputPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    await runCli();
}

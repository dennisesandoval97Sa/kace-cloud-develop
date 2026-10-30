import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AbortedError } from '../errors.mjs';
import { buildUpdateInput, cognitoClient, missingUrls, READ_ONLY_CLIENT_FIELDS } from '../phases/cognitoClient.mjs';
import { makeCtx } from './helpers.mjs';

const ENV = [
    'APPS_SERVICE_NAME=S',
    'AWS_COGNITO_USER_POOL_ID=us-east-1_pool',
    'AWS_COGNITO_APP_CLIENT_ID=client123',
    'AWS_COGNITO_REGION=us-east-1',
    'VITE_COGNITO_REDIRECT_URI_PROD=https://app.example.com/callback',
    'VITE_COGNITO_LOGOUT_URI_PROD=https://app.example.com/logout',
].join('\n');

const CLIENT = {
    UserPoolId: 'us-east-1_pool',
    ClientId: 'client123',
    ClientName: 'kace',
    ClientSecret: 'no-debe-reenviarse',
    CreationDate: '2026-01-01T00:00:00Z',
    LastModifiedDate: '2026-02-01T00:00:00Z',
    AllowedOAuthFlows: ['code'],
    AllowedOAuthScopes: ['openid', 'email'],
    AllowedOAuthFlowsUserPoolClient: true,
    SupportedIdentityProviders: ['KonectaSSO'],
    RefreshTokenValidity: 30,
    TokenValidityUnits: { RefreshToken: 'days' },
    CallbackURLs: ['https://otra.example.com/callback'],
    LogoutURLs: ['https://otra.example.com/logout'],
};

const describeRoute = (client) => ({
    match: 'describe-user-pool-client',
    result: { stdout: JSON.stringify({ UserPoolClient: client }) },
});

describe('helpers', () => {
    it('missingUrls devuelve solo las que faltan', () => {
        assert.deepEqual(missingUrls(['a'], ['a', 'b', '']), ['b']);
        assert.deepEqual(missingUrls(undefined, ['a']), ['a']);
    });

    it('buildUpdateInput conserva todo salvo los campos de solo lectura y añade al final', () => {
        // Act
        const input = buildUpdateInput(CLIENT, { callback: ['https://new/cb'], logout: [] });

        // Assert
        for (const field of READ_ONLY_CLIENT_FIELDS) {
            assert.equal(field in input, false, `${field} no debe reenviarse`);
        }
        assert.deepEqual(input.CallbackURLs, ['https://otra.example.com/callback', 'https://new/cb']);
        assert.deepEqual(input.LogoutURLs, ['https://otra.example.com/logout']);
        assert.deepEqual(input.AllowedOAuthScopes, ['openid', 'email']);
        assert.deepEqual(input.SupportedIdentityProviders, ['KonectaSSO']);
        assert.deepEqual(input.TokenValidityUnits, { RefreshToken: 'days' });
        assert.equal(input.UserPoolId, 'us-east-1_pool');
        assert.equal(input.ClientId, 'client123');
    });
});

describe('cognitoClient', () => {
    it('isDone=true si ambas URLs ya están', async () => {
        // Arrange
        const client = {
            ...CLIENT,
            CallbackURLs: [...CLIENT.CallbackURLs, 'https://app.example.com/callback'],
            LogoutURLs: [...CLIENT.LogoutURLs, 'https://app.example.com/logout'],
        };
        const { ctx, calls } = makeCtx({ envText: ENV, routes: [describeRoute(client)] });

        // Act
        const done = await cognitoClient.isDone(ctx);

        // Assert
        assert.equal(done, true);
        assert.ok(calls[0].line.includes('--user-pool-id us-east-1_pool --client-id client123'));
    });

    it('isDone=false si falta alguna URL', async () => {
        // Arrange
        const { ctx } = makeCtx({ envText: ENV, routes: [describeRoute(CLIENT)] });

        // Act / Assert
        assert.equal(await cognitoClient.isDone(ctx), false);
    });

    it('falla si faltan variables de Cognito', async () => {
        // Arrange
        const { ctx } = makeCtx({ envText: 'APPS_SERVICE_NAME=S\n' });

        // Act / Assert
        await assert.rejects(cognitoClient.isDone(ctx), /Faltan variables para Cognito: AWS_COGNITO_USER_POOL_ID/);
    });

    it('run con --yes actualiza reenviando la config completa más las URLs nuevas', async () => {
        // Arrange
        const { ctx, calls, asked } = makeCtx({
            envText: ENV,
            flags: { yes: true },
            routes: [describeRoute(CLIENT)],
        });

        // Act
        await cognitoClient.run(ctx);

        // Assert
        const update = calls.find((call) => call.line.includes('update-user-pool-client'));
        const input = JSON.parse(update.args[update.args.indexOf('--cli-input-json') + 1]);
        assert.deepEqual(
            input,
            buildUpdateInput(CLIENT, {
                callback: ['https://app.example.com/callback'],
                logout: ['https://app.example.com/logout'],
            })
        );
        assert.ok(update.line.includes('--region us-east-1'));
        assert.equal(asked.length, 0);
    });

    it('run sin --yes pregunta y aborta si se rechaza, sin actualizar', async () => {
        // Arrange
        const { ctx, calls } = makeCtx({ envText: ENV, routes: [describeRoute(CLIENT)], answers: [false] });

        // Act / Assert
        await assert.rejects(cognitoClient.run(ctx), AbortedError);
        assert.equal(
            calls.some((call) => call.line.includes('update-user-pool-client')),
            false
        );
    });

    it('plan devuelve la cabecera y una línea por URL que falta, sin actualizar', async () => {
        // Arrange
        const { ctx, calls } = makeCtx({ envText: ENV, routes: [describeRoute(CLIENT)] });

        // Act
        const lines = await cognitoClient.plan(ctx);

        // Assert
        assert.deepEqual(lines, [
            'App client kace:',
            '+ CallbackURLs https://app.example.com/callback',
            '+ LogoutURLs https://app.example.com/logout',
        ]);
        assert.equal(
            calls.some((call) => call.line.includes('update-user-pool-client')),
            false
        );
    });

    it('plan solo lista las URLs que faltan', async () => {
        // Arrange
        const client = { ...CLIENT, CallbackURLs: [...CLIENT.CallbackURLs, 'https://app.example.com/callback'] };
        const { ctx } = makeCtx({ envText: ENV, routes: [describeRoute(client)] });

        // Act
        const lines = await cognitoClient.plan(ctx);

        // Assert
        assert.deepEqual(lines, ['App client kace:', '+ LogoutURLs https://app.example.com/logout']);
    });
});

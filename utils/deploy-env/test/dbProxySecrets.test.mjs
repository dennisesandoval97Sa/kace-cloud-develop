import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import {
    buildAuth,
    buildResourcePolicy,
    classifyUser,
    dbProxySecrets,
    describePlan,
    redactUsers,
    findProxy,
    maskSecretArn,
    missingAfterModify,
    parseSecret,
    pointsToProxy,
    wantedUsers,
} from '../phases/dbProxySecrets.mjs';
import { AbortedError } from '../errors.mjs';
import { makeCtx } from './helpers.mjs';

const ROLE = 'arn:aws:iam::111122223333:role/rds-proxy-role-kace';
const HOST = 'proxy-kace-dev.proxy-abc123.us-east-1.rds.amazonaws.com';
const READER = 'proxy-kace-dev-ro.endpoint.proxy-abc123.us-east-1.rds.amazonaws.com';
const PASSWORD = 'S3cr3t-Pa55!';
const USER = 'roberto_app';
const OTHER_ARN = 'arn:aws:secretsmanager:us-east-1:111122223333:secret:app_asistencia-AbCdEf';

function authEntry(arn) {
    return {
        UserName: null,
        AuthScheme: 'SECRETS',
        SecretArn: arn,
        IAMAuth: 'DISABLED',
        ClientPasswordAuthType: 'POSTGRES_SCRAM_SHA_256',
    };
}

const PROXIES = [
    { DBProxyName: 'proxy-kace-dev', RoleArn: ROLE, Endpoint: HOST, Auth: [] },
    {
        DBProxyName: 'proxy-otro',
        RoleArn: ROLE,
        Endpoint: 'proxy-otro.proxy-abc123.us-east-1.rds.amazonaws.com',
        Auth: [],
    },
];
const ENDPOINTS = [
    { DBProxyEndpointName: 'ro', DBProxyName: 'proxy-kace-dev', Endpoint: READER, TargetRole: 'READ_ONLY' },
];

describe('pointsToProxy', () => {
    it('reconoce un endpoint de RDS Proxy en DB_HOST o DB_HOST_READER', () => {
        // Arrange / Act / Assert
        assert.equal(pointsToProxy({ DB_HOST: HOST }), true);
        assert.equal(pointsToProxy({ DB_HOST: 'localhost', DB_HOST_READER: READER }), true);
        assert.equal(pointsToProxy({ DB_HOST: 'localhost', DB_HOST_READER: '' }), false);
        assert.equal(pointsToProxy({ DB_HOST: 'db.cluster-abc.us-east-1.rds.amazonaws.com' }), false);
    });
});

describe('findProxy', () => {
    it('detecta por DB_HOST contra el endpoint por defecto', () => {
        // Arrange / Act
        const found = findProxy({ DB_HOST: HOST }, PROXIES, ENDPOINTS);

        // Assert
        assert.equal(found.proxy.DBProxyName, 'proxy-kace-dev');
        assert.equal(found.matchedBy, 'DB_HOST');
    });

    it('detecta por DB_HOST_READER contra un endpoint READ_ONLY', () => {
        // Arrange / Act
        const found = findProxy({ DB_HOST: 'localhost', DB_HOST_READER: READER }, PROXIES, ENDPOINTS);

        // Assert
        assert.equal(found.proxy.DBProxyName, 'proxy-kace-dev');
        assert.equal(found.matchedBy, 'DB_HOST_READER');
    });

    it('no distingue mayúsculas ni espacios', () => {
        // Arrange / Act
        const found = findProxy({ DB_HOST: ` ${HOST.toUpperCase()} ` }, PROXIES, ENDPOINTS);

        // Assert
        assert.equal(found.proxy.DBProxyName, 'proxy-kace-dev');
    });

    it('devuelve null si nada coincide', () => {
        // Arrange / Act / Assert
        assert.equal(findProxy({ DB_HOST: 'localhost' }, PROXIES, ENDPOINTS), null);
    });

    it('lanza si DB_HOST y DB_HOST_READER apuntan a proxies distintos', () => {
        // Arrange
        const env = { DB_HOST: HOST, DB_HOST_READER: 'proxy-otro.proxy-abc123.us-east-1.rds.amazonaws.com' };

        // Act / Assert
        assert.throws(() => findProxy(env, PROXIES, ENDPOINTS), /proxies distintos/);
    });
});

describe('wantedUsers', () => {
    it('devuelve DB_USER y DB_AUXILIAR_USER', () => {
        // Arrange
        const env = { DB_USER: 'a', DB_PASSWORD: 'pa', DB_AUXILIAR_USER: 'b', DB_AUXILIAR_PASSWORD: 'pb' };

        // Act
        const users = wantedUsers(env);

        // Assert
        assert.deepEqual(users, [
            { key: 'DB_USER', passwordKey: 'DB_PASSWORD', username: 'a', password: 'pa' },
            { key: 'DB_AUXILIAR_USER', passwordKey: 'DB_AUXILIAR_PASSWORD', username: 'b', password: 'pb' },
        ]);
    });

    it('descarta usuarios vacíos y deduplica el mismo usuario con la misma contraseña', () => {
        // Arrange / Act / Assert
        assert.deepEqual(wantedUsers({ DB_USER: '', DB_AUXILIAR_USER: '' }), []);
        assert.equal(
            wantedUsers({ DB_USER: 'a', DB_PASSWORD: 'p', DB_AUXILIAR_USER: 'a', DB_AUXILIAR_PASSWORD: 'p' }).length,
            1
        );
    });

    it('lanza si falta la contraseña, sin mostrar el usuario', () => {
        // Arrange / Act / Assert
        assert.throws(
            () => wantedUsers({ DB_USER: USER, DB_PASSWORD: '' }),
            (error) => /DB_PASSWORD/.test(error.message) && !error.message.includes(USER)
        );
    });

    it('lanza si el mismo usuario llega con contraseñas distintas, sin mostrar valores', () => {
        // Arrange
        const env = { DB_USER: USER, DB_PASSWORD: PASSWORD, DB_AUXILIAR_USER: USER, DB_AUXILIAR_PASSWORD: 'otra' };

        // Act / Assert
        assert.throws(
            () => wantedUsers(env),
            (error) =>
                /DB_AUXILIAR_USER/.test(error.message) &&
                !error.message.includes(USER) &&
                !error.message.includes(PASSWORD)
        );
    });
});

describe('parseSecret', () => {
    it('lee username y password, o devuelve null', () => {
        // Arrange / Act / Assert
        assert.deepEqual(parseSecret('{"username":"u","password":"p","engine":"postgres"}'), {
            username: 'u',
            password: 'p',
        });
        assert.equal(parseSecret('no-json'), null);
        assert.equal(parseSecret('{"username":"u"}'), null);
        assert.equal(parseSecret(undefined), null);
    });
});

describe('classifyUser', () => {
    const user = { key: 'DB_USER', passwordKey: 'DB_PASSWORD', username: USER, password: PASSWORD };
    const ARN = 'arn:aws:secretsmanager:us-east-1:111122223333:secret:roberto_app-XyZ123';

    it('asociado y coincide → ok', () => {
        // Arrange / Act
        const result = classifyUser(user, { associated: [{ arn: ARN, username: USER, password: PASSWORD }] });

        // Assert
        assert.equal(result.action, 'ok');
        assert.equal(result.arn, ARN);
    });

    it('asociado y difiere → mismatch', () => {
        // Arrange / Act / Assert
        assert.equal(
            classifyUser(user, { associated: [{ arn: ARN, username: USER, password: 'x' }] }).action,
            'mismatch'
        );
    });

    it('existe por nombre, sin asociar, coincide y sin política → associate con needsPolicy', () => {
        // Arrange
        const byName = { arn: ARN, username: USER, password: PASSWORD, hasPolicy: false, policyAllowsRole: false };

        // Act
        const result = classifyUser(user, { byName, authArns: new Set() });

        // Assert
        assert.deepEqual(
            { action: result.action, needsPolicy: result.needsPolicy, foreignPolicy: result.foreignPolicy },
            { action: 'associate', needsPolicy: true, foreignPolicy: false }
        );
    });

    it('existe por nombre con política ajena → associate con foreignPolicy', () => {
        // Arrange
        const byName = { arn: ARN, username: USER, password: PASSWORD, hasPolicy: true, policyAllowsRole: false };

        // Act
        const result = classifyUser(user, { byName, authArns: new Set() });

        // Assert
        assert.equal(result.needsPolicy, false);
        assert.equal(result.foreignPolicy, true);
    });

    it('existe por nombre y ya está en Auth (ilegible como asociado) → ok', () => {
        // Arrange
        const byName = { arn: ARN, username: USER, password: PASSWORD, hasPolicy: true, policyAllowsRole: true };

        // Act / Assert
        assert.equal(classifyUser(user, { byName, authArns: new Set([ARN]) }).action, 'ok');
    });

    it('existe por nombre y difiere (contraseña, username u otro formato) → mismatch', () => {
        // Arrange / Act / Assert
        for (const byName of [
            { arn: ARN, username: USER, password: 'x' },
            { arn: ARN, username: 'otro', password: PASSWORD },
            { arn: ARN, username: undefined, password: undefined },
        ]) {
            assert.equal(classifyUser(user, { byName, authArns: new Set() }).action, 'mismatch');
        }
    });

    it('no existe → create', () => {
        // Arrange / Act / Assert
        assert.equal(classifyUser(user, { associated: [], byName: null }).action, 'create');
    });
});

describe('buildAuth', () => {
    it('conserva las entradas sin campos null y añade las nuevas copiando el esquema', () => {
        // Arrange
        const current = [authEntry(OTHER_ARN)];

        // Act
        const auth = buildAuth(current, ['arn:new']);

        // Assert
        assert.deepEqual(auth, [
            {
                AuthScheme: 'SECRETS',
                SecretArn: OTHER_ARN,
                IAMAuth: 'DISABLED',
                ClientPasswordAuthType: 'POSTGRES_SCRAM_SHA_256',
            },
            {
                AuthScheme: 'SECRETS',
                IAMAuth: 'DISABLED',
                ClientPasswordAuthType: 'POSTGRES_SCRAM_SHA_256',
                SecretArn: 'arn:new',
            },
        ]);
    });

    it('usa el esquema por defecto si no hay entradas y no duplica ARN ya presentes', () => {
        // Arrange / Act
        const empty = buildAuth([], ['arn:a']);
        const dup = buildAuth([authEntry('arn:a')], ['arn:a']);

        // Assert
        assert.deepEqual(empty, [
            {
                AuthScheme: 'SECRETS',
                IAMAuth: 'DISABLED',
                ClientPasswordAuthType: 'POSTGRES_SCRAM_SHA_256',
                SecretArn: 'arn:a',
            },
        ]);
        assert.equal(dup.length, 1);
    });
});

describe('buildResourcePolicy', () => {
    it('concede GetSecretValue al rol del proxy', () => {
        // Arrange / Act
        const policy = buildResourcePolicy(ROLE);

        // Assert
        assert.deepEqual(policy, {
            Version: '2012-10-17',
            Statement: [
                {
                    Sid: 'AllowRdsProxyRead',
                    Effect: 'Allow',
                    Principal: { AWS: ROLE },
                    Action: 'secretsmanager:GetSecretValue',
                    Resource: '*',
                },
            ],
        });
    });
});

describe('missingAfterModify', () => {
    it('devuelve los ARN esperados que no están tras el modify', () => {
        // Arrange / Act / Assert
        assert.deepEqual(missingAfterModify(['a', 'b', 'c'], [{ SecretArn: 'a' }, { SecretArn: 'c' }]), ['b']);
        assert.deepEqual(missingAfterModify(['a'], [{ SecretArn: 'a' }]), []);
    });
});

describe('maskSecretArn', () => {
    it('oculta el nombre entero y conserva solo el sufijo aleatorio de AWS', () => {
        // Arrange / Act
        const masked = maskSecretArn('arn:aws:secretsmanager:us-east-1:111122223333:secret:roberto_app-XyZ123');

        // Assert
        assert.equal(masked, 'arn:aws:secretsmanager:us-east-1:111122223333:secret:****-XyZ123');
        assert.ok(!masked.includes('rob'));
    });

    it('sin sufijo de AWS oculta todo el nombre', () => {
        // Arrange / Act / Assert
        assert.equal(
            maskSecretArn('arn:aws:secretsmanager:us-east-1:111122223333:secret:roberto_app'),
            'arn:aws:secretsmanager:us-east-1:111122223333:secret:****'
        );
    });
});

const OTHER_PASSWORD = 'otra-clave-1';
const USER_ARN = 'arn:aws:secretsmanager:us-east-1:111122223333:secret:roberto_app-XyZ123';

function arg(args, flag) {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
}

function fail(code, message) {
    return { code: 254, stderr: `An error occurred (${code}) when calling the operation: ${message}` };
}

/**
 * AWS falso con estado: proxies, endpoints y secretos. Registra en `world.writes` cada escritura.
 * `statusQueue` cambia el Status del proxy en cada describe con --db-proxy-name.
 */
function fakeAws(world) {
    const ok = (data) => ({ stdout: JSON.stringify(data) });
    const findSecret = (id) => world.secrets.find((secret) => secret.arn === id || secret.name === id);
    return [
        {
            match: /^aws /,
            result: (call) => {
                const args = call.args.slice(1);
                const [service, operation] = args;
                const secret = findSecret(arg(args, '--secret-id'));
                switch (`${service} ${operation}`) {
                    case 'rds describe-db-proxies': {
                        const name = arg(args, '--db-proxy-name');
                        const list = name ? world.proxies.filter((proxy) => proxy.DBProxyName === name) : world.proxies;
                        if (name && world.statusQueue.length) {
                            list[0].Status = world.statusQueue.shift();
                        }
                        return ok({ DBProxies: structuredClone(list) });
                    }
                    case 'rds describe-db-proxy-endpoints':
                        return ok({ DBProxyEndpoints: world.endpoints });
                    case 'rds modify-db-proxy': {
                        const auth = JSON.parse(arg(args, '--auth'));
                        world.writes.push({ op: 'modify-db-proxy', auth });
                        const proxy = world.proxies.find((item) => item.DBProxyName === arg(args, '--db-proxy-name'));
                        proxy.Auth = auth.slice(world.modifyDrops || 0);
                        return ok({ DBProxy: structuredClone(proxy) });
                    }
                    case 'secretsmanager get-secret-value':
                        if (!secret) {
                            return fail(
                                'ResourceNotFoundException',
                                'Secrets Manager can’t find the specified secret.'
                            );
                        }
                        if (secret.unreadable) {
                            return fail(
                                'AccessDeniedException',
                                `not authorized to perform: secretsmanager:GetSecretValue on resource: ${secret.arn}`
                            );
                        }
                        return ok({ ARN: secret.arn, Name: secret.name, SecretString: JSON.stringify(secret.value) });
                    case 'secretsmanager describe-secret':
                        return secret
                            ? ok({ ARN: secret.arn, Name: secret.name })
                            : fail('ResourceNotFoundException', 'Secrets Manager can’t find the specified secret.');
                    case 'secretsmanager get-resource-policy':
                        return ok({
                            ARN: secret.arn,
                            Name: secret.name,
                            ...(secret.policy ? { ResourcePolicy: secret.policy } : {}),
                        });
                    case 'secretsmanager create-secret': {
                        const file = arg(args, '--secret-string').replace(/^file:\/\//, '');
                        const created = {
                            arn: `arn:aws:secretsmanager:us-east-1:111122223333:secret:${arg(args, '--name')}-XyZ123`,
                            name: arg(args, '--name'),
                            value: JSON.parse(readFileSync(file, 'utf8')),
                        };
                        world.writes.push({
                            op: 'create-secret',
                            name: created.name,
                            file,
                            mode: statSync(file).mode & 0o777,
                            value: created.value,
                        });
                        if (world.failCreate) {
                            return fail(
                                'AccessDeniedException',
                                `not authorized to perform: secretsmanager:CreateSecret on resource: ${created.name}`
                            );
                        }
                        world.secrets.push(created);
                        return ok({ ARN: created.arn, Name: created.name });
                    }
                    case 'secretsmanager put-resource-policy':
                        secret.policy = arg(args, '--resource-policy');
                        world.writes.push({
                            op: 'put-resource-policy',
                            secretId: arg(args, '--secret-id'),
                            policy: JSON.parse(secret.policy),
                            block: args.includes('--block-public-policy'),
                        });
                        return ok({ ARN: secret.arn, Name: secret.name });
                    default:
                        return fail('UnknownOperation', call.line);
                }
            },
        },
    ];
}

function world(overrides = {}) {
    return {
        proxies: [
            {
                DBProxyName: 'proxy-kace-dev',
                Status: 'available',
                RoleArn: ROLE,
                Endpoint: HOST,
                Auth: [authEntry(OTHER_ARN)],
            },
        ],
        endpoints: [
            { DBProxyEndpointName: 'ro', DBProxyName: 'proxy-kace-dev', Endpoint: READER, TargetRole: 'READ_ONLY' },
        ],
        secrets: [
            { arn: OTHER_ARN, name: 'app_asistencia', value: { username: 'app_asistencia', password: OTHER_PASSWORD } },
        ],
        statusQueue: [],
        writes: [],
        ...overrides,
    };
}

function envText({ host = HOST, reader = '', extra = '' } = {}) {
    return `APPS_SERVICE_NAME=svc\nDB_HOST=${host}\nDB_HOST_READER=${reader}\nDB_USER=${USER}\nDB_PASSWORD=${PASSWORD}\n${extra}`;
}

function setup({ w = world(), env = envText(), flags = {}, answers = [] } = {}) {
    const made = makeCtx({ envText: env, flags, answers, routes: fakeAws(w) });
    return { ...made, w };
}

function assertNoLeak({ output, calls }, error) {
    const printed = [output.join(''), error?.message || ''].join('\n');
    const argv = calls.map((call) => call.line).join('\n');
    for (const value of [PASSWORD, OTHER_PASSWORD]) {
        assert.ok(!printed.includes(value), 'una contraseña aparece en la salida o el error');
        assert.ok(!argv.includes(value), 'una contraseña aparece en los argumentos de un proceso');
    }
    assert.ok(!printed.includes(USER), 'el nombre de usuario aparece en la salida o el error');
}

const CREATE_LINES = [
    'Proxy proxy-kace-dev (detectado por DB_HOST):',
    '+ secreto nuevo para DB_USER',
    '+ política de acceso para rds-proxy-role-kace en el secreto de DB_USER',
    '+ asociar el secreto de DB_USER',
];

describe('dbProxySecrets.applies', () => {
    it('DB_HOST=localhost → false sin llamar a AWS', async () => {
        // Arrange
        const t = setup({ env: envText({ host: 'localhost' }) });

        // Act
        const applies = await dbProxySecrets.applies(t.ctx);

        // Assert
        assert.equal(applies, false);
        assert.equal(t.calls.length, 0);
    });

    it('DB_HOST apunta al proxy → true', async () => {
        // Arrange
        const t = setup();

        // Act / Assert
        assert.equal(await dbProxySecrets.applies(t.ctx), true);
    });

    it('solo DB_HOST_READER apunta a un endpoint READ_ONLY → true', async () => {
        // Arrange
        const t = setup({ env: envText({ host: 'localhost', reader: READER }) });

        // Act / Assert
        assert.equal(await dbProxySecrets.applies(t.ctx), true);
    });

    it('parece un proxy pero no existe en la región → error, nunca no aplica', async () => {
        // Arrange
        const t = setup({ env: envText({ host: 'proxy-x.proxy-zzz999.us-east-1.rds.amazonaws.com' }) });

        // Act
        const error = await dbProxySecrets.applies(t.ctx).catch((caught) => caught);

        // Assert
        assert.equal(
            error.message,
            'DB_HOST parece un endpoint de RDS Proxy pero no coincide con ningún proxy de la región us-east-1. ' +
                '¿Perfil o región AWS equivocados?'
        );
        assert.ok(!error.message.includes('zzz999'));
    });

    it('el error nombra la cuenta si se conoce y todas las claves que parecen proxy', async () => {
        // Arrange
        const host = 'proxy-x.proxy-zzz999.us-east-1.rds.amazonaws.com';
        const t = setup({ env: envText({ host, reader: host }) });
        t.ctx.account = '111122223333';

        // Act
        const error = await dbProxySecrets.applies(t.ctx).catch((caught) => caught);

        // Assert
        assert.equal(
            error.message,
            'DB_HOST y DB_HOST_READER parecen endpoints de RDS Proxy pero no coinciden con ningún proxy de la ' +
                'región us-east-1 (cuenta 111122223333). ¿Perfil o región AWS equivocados?'
        );
    });
});

describe('dbProxySecrets.isDone / plan', () => {
    it('usuario sin secreto → plan de crear, política y asociar, sin escrituras', async () => {
        // Arrange
        const t = setup();

        // Act
        const done = await dbProxySecrets.isDone(t.ctx);
        const lines = await dbProxySecrets.plan(t.ctx);

        // Assert
        assert.equal(done, false);
        assert.deepEqual(lines, CREATE_LINES);
        assert.deepEqual(t.w.writes, []);
        assertNoLeak(t);
    });

    it('usuario ya asociado y coincide → hecho', async () => {
        // Arrange
        const w = world();
        w.secrets.push({ arn: USER_ARN, name: USER, value: { username: USER, password: PASSWORD } });
        w.proxies[0].Auth.push(authEntry(USER_ARN));
        const t = setup({ w });

        // Act / Assert
        assert.equal(await dbProxySecrets.isDone(t.ctx), true);
    });

    it('usuario asociado con otra contraseña → error sin tocar nada ni filtrar valores', async () => {
        // Arrange
        const w = world();
        w.secrets.push({ arn: USER_ARN, name: USER, value: { username: USER, password: 'vieja' } });
        w.proxies[0].Auth.push(authEntry(USER_ARN));
        const t = setup({ w });

        // Act
        const error = await dbProxySecrets.isDone(t.ctx).catch((caught) => caught);

        // Assert
        assert.match(error.message, /no coincide con DB_USER\/DB_PASSWORD/);
        assert.ok(error.message.includes(maskSecretArn(USER_ARN)));
        assert.deepEqual(w.writes, []);
        assertNoLeak(t, error);
    });

    it('secreto por nombre sin asociar ni política → política y asociar, sin crear', async () => {
        // Arrange
        const w = world();
        w.secrets.push({ arn: USER_ARN, name: USER, value: { username: USER, password: PASSWORD } });
        const t = setup({ w });

        // Act
        const lines = await dbProxySecrets.plan(t.ctx);

        // Assert
        assert.deepEqual(lines, [
            'Proxy proxy-kace-dev (detectado por DB_HOST):',
            '+ política de acceso para rds-proxy-role-kace en el secreto de DB_USER',
            '+ asociar el secreto de DB_USER',
        ]);
    });

    it('secreto por nombre con política ajena → asociar y aviso, sin tocar la política', async () => {
        // Arrange
        const w = world();
        w.secrets.push({
            arn: USER_ARN,
            name: USER,
            value: { username: USER, password: PASSWORD },
            policy: '{"Version":"2012-10-17","Statement":[]}',
        });
        const t = setup({ w });

        // Act
        const lines = await dbProxySecrets.plan(t.ctx);

        // Assert
        assert.deepEqual(lines, [
            'Proxy proxy-kace-dev (detectado por DB_HOST):',
            '+ asociar el secreto de DB_USER',
            '! DB_USER: su secreto ya tiene una política de recurso que no incluye rds-proxy-role-kace; no se toca',
        ]);
    });

    it('secreto por nombre con otra contraseña → error', async () => {
        // Arrange
        const w = world();
        w.secrets.push({ arn: USER_ARN, name: USER, value: { username: USER, password: 'vieja' } });
        const t = setup({ w });

        // Act
        const error = await dbProxySecrets.plan(t.ctx).catch((caught) => caught);

        // Assert
        assert.match(error.message, /no coincide/);
        assertNoLeak(t, error);
    });

    it('secreto asociado ilegible → aviso enmascarado y el resto sigue', async () => {
        // Arrange
        const w = world();
        w.secrets[0].unreadable = true;
        const t = setup({ w });

        // Act
        const lines = await dbProxySecrets.plan(t.ctx);

        // Assert
        assert.deepEqual(lines, [...CREATE_LINES, `! no se pudo leer el secreto asociado ${maskSecretArn(OTHER_ARN)}`]);
    });

    it('DB_AUXILIAR_USER igual que DB_USER con la misma contraseña → un solo secreto', async () => {
        // Arrange
        const t = setup({ env: envText({ extra: `DB_AUXILIAR_USER=${USER}\nDB_AUXILIAR_PASSWORD=${PASSWORD}\n` }) });

        // Act / Assert
        assert.deepEqual(await dbProxySecrets.plan(t.ctx), CREATE_LINES);
    });

    it('describePlan marca como hecho un usuario ok', () => {
        // Arrange
        const state = {
            proxy: { DBProxyName: 'proxy-kace-dev', RoleArn: ROLE },
            matchedBy: 'DB_HOST_READER',
            plans: [{ user: { key: 'DB_AUXILIAR_USER' }, action: 'ok' }],
            warnings: [],
        };

        // Act / Assert
        assert.deepEqual(describePlan(state), [
            'Proxy proxy-kace-dev (detectado por DB_HOST_READER):',
            '= el secreto de DB_AUXILIAR_USER ya está asociado',
        ]);
    });
});

describe('redactUsers / errores de AWS', () => {
    it('redactUsers sustituye cada usuario por su clave, el más largo primero', () => {
        // Arrange
        const users = [
            { key: 'DB_USER', username: 'app' },
            { key: 'DB_AUXILIAR_USER', username: 'app_aux' },
        ];

        // Act
        const text = redactUsers('x app_aux y app z app', users);

        // Assert
        assert.equal(text, 'x <DB_AUXILIAR_USER> y <DB_USER> z <DB_USER>');
        assert.equal(redactUsers(undefined, users), '');
    });

    it('secreto por nombre ilegible → error sin el nombre de usuario', async () => {
        // Arrange
        const w = world();
        w.secrets.push({ arn: USER_ARN, name: USER, value: { username: USER, password: PASSWORD }, unreadable: true });
        const t = setup({ w });

        // Act
        const error = await dbProxySecrets.plan(t.ctx).catch((caught) => caught);

        // Assert
        assert.match(error.message, /secretsmanager:GetSecretValue/);
        assert.match(error.message, /<DB_USER>/);
        assert.equal(error.cause, undefined);
        assert.equal(error.result, undefined);
        assertNoLeak(t, error);
    });
});

describe('dbProxySecrets.run', () => {
    it('crea el secreto por fichero 0600, le da acceso al rol y lo asocia sin quitar nada', async () => {
        // Arrange
        const t = setup({ flags: { yes: true } });

        // Act
        const outcome = await dbProxySecrets.run(t.ctx);

        // Assert
        assert.equal(outcome, undefined);
        assert.deepEqual(
            t.w.writes.map((write) => write.op),
            ['create-secret', 'put-resource-policy', 'modify-db-proxy']
        );
        const [create, policy, modify] = t.w.writes;
        assert.equal(create.name, USER);
        assert.equal(create.mode, 0o600);
        assert.deepEqual(create.value, { username: USER, password: PASSWORD });
        assert.equal(existsSync(create.file), false);
        assert.equal(policy.secretId, USER_ARN);
        assert.deepEqual(policy.policy, buildResourcePolicy(ROLE));
        assert.equal(policy.block, true);
        assert.deepEqual(
            modify.auth.map((entry) => entry.SecretArn),
            [OTHER_ARN, USER_ARN]
        );
        assert.ok(modify.auth.every((entry) => !('UserName' in entry)));
        assertNoLeak(t);
    });

    it('guarda la lista Auth previa en un fichero junto al .env', async () => {
        // Arrange
        const t = setup({ flags: { yes: true } });

        // Act
        await dbProxySecrets.run(t.ctx);

        // Assert
        const backup = `${t.file}.proxy-auth-20260929100000.json`;
        assert.equal(statSync(backup).mode & 0o777, 0o600);
        assert.deepEqual(JSON.parse(readFileSync(backup, 'utf8')), buildAuth([authEntry(OTHER_ARN)], []));
        assert.ok(t.output.join('').includes(`Copia de la lista Auth previa: ${backup}`));
    });

    it('relee Auth justo antes del modify y conserva lo que otro añadió entretanto', async () => {
        // Arrange
        const w = world();
        const t = setup({ w, flags: { yes: true } });
        const lateArn = 'arn:aws:secretsmanager:us-east-1:111122223333:secret:tardio-QwErTy';
        const originalRun = t.ctx.run;
        t.ctx.run = async (cmd, args, opts) => {
            if (args.includes('put-resource-policy')) {
                w.proxies[0].Auth.push(authEntry(lateArn));
            }
            return originalRun(cmd, args, opts);
        };

        // Act
        await dbProxySecrets.run(t.ctx);

        // Assert
        const modify = w.writes.find((write) => write.op === 'modify-db-proxy');
        assert.deepEqual(
            modify.auth.map((entry) => entry.SecretArn),
            [OTHER_ARN, lateArn, USER_ARN]
        );
    });

    it('si create-secret falla, el fichero temporal no queda y no se modifica el proxy', async () => {
        // Arrange
        const t = setup({ w: world({ failCreate: true }), flags: { yes: true } });

        // Act
        const error = await dbProxySecrets.run(t.ctx).catch((caught) => caught);

        // Assert
        assert.match(error.message, /CreateSecret/);
        assert.match(error.message, /<DB_USER>/);
        assert.equal(existsSync(t.w.writes[0].file), false);
        assert.ok(!t.w.writes.some((write) => write.op === 'modify-db-proxy'));
        assertNoLeak(t, error);
    });

    it('con terminal y respuesta negativa → abortado sin escrituras', async () => {
        // Arrange
        const t = setup({ answers: [false] });

        // Act
        const error = await dbProxySecrets.run(t.ctx).catch((caught) => caught);

        // Assert
        assert.ok(error instanceof AbortedError);
        assert.equal(t.asked.length, 1);
        assert.deepEqual(t.w.writes, []);
    });

    it('con --yes no pregunta', async () => {
        // Arrange
        const t = setup({ flags: { yes: true } });

        // Act
        await dbProxySecrets.run(t.ctx);

        // Assert
        assert.equal(t.asked.length, 0);
    });

    it('reanudación: secreto ya creado con política → solo modify', async () => {
        // Arrange
        const w = world();
        w.secrets.push({
            arn: USER_ARN,
            name: USER,
            value: { username: USER, password: PASSWORD },
            policy: JSON.stringify(buildResourcePolicy(ROLE)),
        });
        const t = setup({ w, flags: { yes: true } });

        // Act
        await dbProxySecrets.run(t.ctx);

        // Assert
        assert.deepEqual(
            w.writes.map((write) => write.op),
            ['modify-db-proxy']
        );
    });

    it('reanudación: secreto ya creado sin política → política y modify, sin crear', async () => {
        // Arrange
        const w = world();
        w.secrets.push({ arn: USER_ARN, name: USER, value: { username: USER, password: PASSWORD } });
        const t = setup({ w, flags: { yes: true } });

        // Act
        await dbProxySecrets.run(t.ctx);

        // Assert
        assert.deepEqual(
            w.writes.map((write) => write.op),
            ['put-resource-policy', 'modify-db-proxy']
        );
    });

    it('espera a que el proxy esté available antes de escribir', async () => {
        // Arrange
        const t = setup({ w: world({ statusQueue: ['modifying', 'available'] }), flags: { yes: true } });

        // Act
        await dbProxySecrets.run(t.ctx);

        // Assert
        assert.deepEqual(t.sleeps, [15000]);
        assert.ok(t.output.join('').includes('esperando al proxy proxy-kace-dev (modifying)'));
    });

    it('si el proxy no vuelve a available en el límite → error sin escrituras', async () => {
        // Arrange
        const w = world();
        w.proxies[0].Status = 'modifying';
        const t = setup({ w, flags: { yes: true } });

        // Act
        const error = await dbProxySecrets.run(t.ctx).catch((caught) => caught);

        // Assert
        assert.match(error.message, /sigue en modifying/);
        assert.equal(t.sleeps.length, 40);
        assert.deepEqual(w.writes, []);
    });

    it('si el proxy desaparece mientras se espera → error inmediato, sin bucle ni escrituras', async () => {
        // Arrange
        const w = world();
        const t = setup({ w, flags: { yes: true } });
        const originalRun = t.ctx.run;
        let described = 0;
        t.ctx.run = async (cmd, args, opts) => {
            if (args.includes('describe-db-proxies') && args.includes('--db-proxy-name') && described++ === 0) {
                w.proxies = [];
            }
            return originalRun(cmd, args, opts);
        };

        // Act
        const error = await dbProxySecrets.run(t.ctx).catch((caught) => caught);

        // Assert
        assert.equal(error.message, 'El proxy proxy-kace-dev ya no existe.');
        assert.equal(t.sleeps.length, 0);
        assert.deepEqual(w.writes, []);
    });

    it('si tras el modify falta un ARN → error con la copia y el comando de restauración', async () => {
        // Arrange
        const t = setup({ w: world({ modifyDrops: 1 }), flags: { yes: true } });

        // Act
        const error = await dbProxySecrets.run(t.ctx).catch((caught) => caught);

        // Assert
        const backup = `${t.file}.proxy-auth-20260929100000.json`;
        assert.match(error.message, /faltan 1 secreto/);
        assert.ok(
            error.message.includes(
                `aws rds modify-db-proxy --db-proxy-name proxy-kace-dev --region us-east-1 --auth file://${backup}`
            )
        );
        assertNoLeak(t, error);
    });

    it('con avisos devuelve { warning }', async () => {
        // Arrange
        const w = world();
        w.secrets[0].unreadable = true;
        const t = setup({ w, flags: { yes: true } });

        // Act
        const outcome = await dbProxySecrets.run(t.ctx);

        // Assert
        assert.match(outcome.warning, /1 aviso/);
    });
});

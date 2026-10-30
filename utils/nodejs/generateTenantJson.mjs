#!/usr/bin/env node
/**
 * generateTenantJson.mjs
 *
 * Genera el JSON del Tenant (item de DynamoDB / payload de POST /tenant) a partir
 * de un archivo dotenv.
 *
 * El contrato de campos NO está hardcodeado: en cada ejecución se lee y parsea
 * `packages/kace_cloud_core/src/tenant/domain/Tenant.js` y se extraen los campos
 * que el constructor consume de `dto`, junto con su tipo (ValueObjectString /
 * ValueObjectInt / ValueObject) y si son nulables. Si la entidad cambia, el
 * script se entera solo y valida contra la versión vigente.
 *
 * Mapeo env -> campo: por convención el campo `db_host` se busca en `DB_HOST`.
 * Solo los casos que no siguen la convención están en ENV_OVERRIDES.
 *
 * Uso:
 *   node utils/nodejs/generateTenantJson.mjs                       # usa ./.env
 *   node utils/nodejs/generateTenantJson.mjs .env.sara             # archivo puntual
 *   node utils/nodejs/generateTenantJson.mjs .env.sara -o tenant.json
 *   node utils/nodejs/generateTenantJson.mjs .env --id <uuid>      # fija el id
 *   node utils/nodejs/generateTenantJson.mjs .env --dynamodb       # item AttributeValue
 *   node utils/nodejs/generateTenantJson.mjs .env --check          # solo valida
 *
 * El JSON va a stdout y el reporte de validación a stderr, así que se puede
 * redirigir sin ensuciar el archivo:
 *   node utils/nodejs/generateTenantJson.mjs .env > tenant.json
 *
 * Exit codes: 0 = ok, 1 = faltan campos requeridos o hay valores inválidos.
 *
 * OJO: el JSON resultante contiene secretos (db_password, secret_key, etc.).
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '../..');
const TENANT_ENTITY_PATH = path.join(PROJECT_ROOT, 'packages/kace_cloud_core/src/tenant/domain/Tenant.js');

/**
 * Campos cuyo nombre de variable de entorno no es el uppercase directo del campo.
 * Se evalúan en orden: la primera variable con valor gana.
 * La primera candidata siempre es la convención canónica, para que un rename en
 * el .env hacia el nombre canónico funcione sin tocar este mapa.
 */
const ENV_OVERRIDES = {
    id: ['TENANT_ID', 'VITE_TENANT_ID'],
    subdomain: ['SUBDOMAIN', 'APPS_API_SUBDOMAIN'],
    db_name: ['DB_NAME', 'DB_DATABASE'],
    aws_cognito_identity_provider: ['AWS_COGNITO_IDENTITY_PROVIDER', 'VITE_IDENTITY_PROVIDER'],
    aws_cognito_response_type: ['AWS_COGNITO_RESPONSE_TYPE', 'VITE_COGNITO_RESPONSE_TYPE'],
    aws_cognito_scope: ['AWS_COGNITO_SCOPE', 'VITE_COGNITO_SCOPE'],
    aws_cognito_redirect_to_exchange: ['AWS_COGNITO_REDIRECT_TO_EXCHANGE', 'VITE_COGNITO_REDIRECT_URI_PROD'],
    aws_cognito_redirect_to_frontend: ['AWS_COGNITO_REDIRECT_TO_FRONTEND', 'VITE_COGNITO_LOGOUT_URI_PROD'],
    aws_event_bridge_region: ['AWS_EVENT_BRIDGE_REGION', 'AWS_EVENTBRIDGE_REGION', 'AWS_SQS_REGION'],
    aws_event_bridge_event_bus_name: ['AWS_EVENT_BRIDGE_EVENT_BUS_NAME', 'AWS_EVENTBRIDGE_EVENT_BUS_NAME'],
    aws_case_post_processing_queue_url: [
        'AWS_CASE_POST_PROCESSING_QUEUE_URL',
        'AWS_CASE_POST_PROCESSING_EVENTS_QUEUE_URL',
    ],
};

/** Valores que en los .env significan "lo entregan los administradores", es decir: sin valor. */
const PLACEHOLDER_VALUES = new Set(['ADMINISTRADORES', 'CHANGE_ME', 'TODO']);

/**
 * Formatos de salida:
 * - plain:    JSON plano. Es lo que consume el POST /tenant y el DocumentClient
 *             (`PutCommand` de @aws-sdk/lib-dynamodb, que marshalla solo).
 * - dynamodb: item con AttributeValues ({"S": ...} / {"N": "..."}), el formato del
 *             cliente de bajo nivel y de `aws dynamodb put-item --item file://...`.
 */
const FORMATS = ['plain', 'dynamodb'];

const COLORS = {
    reset: '\u001b[0m',
    red: '\u001b[31m',
    green: '\u001b[32m',
    yellow: '\u001b[33m',
    gray: '\u001b[90m',
    bold: '\u001b[1m',
};

const useColor = process.stderr.isTTY === true;
const paint = (color, text) => (useColor ? `${COLORS[color]}${text}${COLORS.reset}` : text);

// SONAR-EXC: NODEJS script de línea de comandos, la salida por consola es la interfaz
const out = (message) => process.stderr.write(`${message}\n`);

const HELP = `
generateTenantJson.mjs - genera el JSON del Tenant desde un archivo dotenv

  node utils/nodejs/generateTenantJson.mjs [archivo.env] [opciones]

Opciones:
  -e, --env <archivo>   Archivo dotenv de entrada (por defecto: <raíz>/.env)
  -o, --out <archivo>   Escribe el JSON en un archivo en vez de stdout
      --id <uuid>       Fija el id del tenant (si no, se toma de TENANT_ID/VITE_TENANT_ID
                        y si tampoco existe se genera un UUID v4)
  -f, --format <fmt>    plain (por defecto) = JSON plano para POST /tenant y DocumentClient
                        dynamodb = item con AttributeValues, para aws dynamodb put-item
      --dynamodb        Atajo de --format dynamodb
      --check           Solo valida el contrato, no emite JSON
      --include-empty   Incluye los campos opcionales sin valor como null
      --allow-missing   No falla (exit 0) aunque falten campos requeridos
  -h, --help            Muestra esta ayuda
`;

/**
 * Parsea los argumentos de línea de comandos.
 * @param {string[]} argv
 * @returns {{envFile: string|null, outFile: string|null, id: string|null, check: boolean, includeEmpty: boolean, allowMissing: boolean, help: boolean}}
 */
function parseArgs(argv) {
    const options = {
        envFile: null,
        outFile: null,
        id: null,
        format: 'plain',
        check: false,
        includeEmpty: false,
        allowMissing: false,
        help: false,
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        switch (arg) {
            case '-h':
            case '--help':
                options.help = true;
                break;
            case '-e':
            case '--env':
                options.envFile = argv[++i];
                break;
            case '-o':
            case '--out':
                options.outFile = argv[++i];
                break;
            case '--id':
                options.id = argv[++i];
                break;
            case '-f':
            case '--format':
                options.format = argv[++i];
                if (!FORMATS.includes(options.format)) {
                    throw new Error(`Formato desconocido: ${options.format} (usa ${FORMATS.join(' | ')})`);
                }
                break;
            case '--dynamodb':
                options.format = 'dynamodb';
                break;
            case '--check':
                options.check = true;
                break;
            case '--include-empty':
                options.includeEmpty = true;
                break;
            case '--allow-missing':
                options.allowMissing = true;
                break;
            default:
                if (arg.startsWith('-')) {
                    throw new Error(`Opción desconocida: ${arg}`);
                }
                if (options.envFile === null) {
                    options.envFile = arg;
                } else {
                    throw new Error(`Argumento posicional inesperado: ${arg}`);
                }
        }
    }

    return options;
}

/**
 * Parser de dotenv sin dependencias. Soporta `export KEY=value`, comillas simples
 * y dobles, y comentarios (de línea completa y al final de valores sin comillas).
 * No interpola `${VAR}`: los .env de este repo no lo usan.
 * @param {string} content
 * @returns {Record<string, string>}
 */
function parseDotenv(content) {
    const values = {};

    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (line === '' || line.startsWith('#')) {
            continue;
        }

        const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
        if (!match) {
            continue;
        }

        const [, key] = match;
        let value = match[2].trim();
        const quoted =
            value.length >= 2 &&
            ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")));

        if (quoted) {
            value = value.slice(1, -1);
        } else {
            value = value.replace(/\s+#.*$/, '').trim();
        }

        values[key] = value;
    }

    return values;
}

/**
 * Extrae el contrato de campos vigente desde el código fuente de la entidad Tenant.
 * Busca las asignaciones `this.#campo = new ValueObjectX('campo', dto.campo, nullable)`
 * del constructor (los setters no se capturan porque no leen de `dto`).
 * @param {string} source Código fuente de Tenant.js
 * @returns {Array<{field: string, dtoKey: string, valueObject: string, nullable: boolean, type: 'int'|'string'|'raw'}>}
 */
function extractTenantContract(source) {
    const pattern =
        /this\.#(\w+)\s*=\s*new\s+(ValueObject\w*)\s*\(\s*'([^']+)'\s*,\s*dto\.(\w+)\s*(?:,\s*(true|false)\s*)?\)/g;

    const fields = [];
    const seen = new Set();
    let match;

    while ((match = pattern.exec(source)) !== null) {
        const [, privateName, valueObject, label, dtoKey, nullableRaw] = match;

        if (seen.has(privateName)) {
            continue;
        }
        seen.add(privateName);

        let type = 'string';
        if (valueObject === 'ValueObjectInt' || valueObject === 'ValueObjectIntPositives') {
            type = 'int';
        } else if (valueObject === 'ValueObject') {
            type = 'raw';
        }

        fields.push({
            field: privateName,
            label,
            dtoKey,
            valueObject,
            nullable: nullableRaw === 'true',
            type,
        });
    }

    if (fields.length === 0) {
        throw new Error(
            `No se pudo extraer ningún campo de ${TENANT_ENTITY_PATH}. ` +
                '¿Cambió la forma del constructor de Tenant? Revisa extractTenantContract().'
        );
    }

    return fields;
}

/**
 * Devuelve las variables de entorno candidatas para un campo, en orden de prioridad.
 * @param {string} field
 * @returns {string[]}
 */
function envCandidatesFor(field) {
    return ENV_OVERRIDES[field] ?? [field.toUpperCase()];
}

/**
 * Resuelve el valor de un campo contra el dotenv ya parseado.
 * @param {{field: string, type: string}} spec
 * @param {Record<string, string>} env
 * @returns {{value: string|null, source: string|null, placeholder: boolean, candidates: string[]}}
 */
function resolveValue(spec, env) {
    const candidates = envCandidatesFor(spec.field);
    let placeholder = false;

    for (const candidate of candidates) {
        const raw = env[candidate];
        if (raw === undefined || raw.trim() === '') {
            continue;
        }
        if (PLACEHOLDER_VALUES.has(raw.trim().toUpperCase())) {
            placeholder = true;
            continue;
        }

        return { value: raw.trim(), source: candidate, placeholder: false, candidates };
    }

    return { value: null, source: null, placeholder, candidates };
}

/**
 * Construye el JSON del tenant y el reporte de validación.
 * @param {Array<Object>} contract
 * @param {Record<string, string>} env
 * @param {{id: string|null, includeEmpty: boolean}} options
 */
function buildTenantJson(contract, env, options) {
    const json = {};
    const report = { resolved: [], missingRequired: [], missingOptional: [], invalid: [], drift: [] };

    // El id lo consume AggregateRoot vía `super(dto.id)`, no aparece en el contrato parseado.
    const idResolution = resolveValue({ field: 'id', type: 'string' }, env);
    let tenantId = options.id ?? idResolution.value;
    let idSource = options.id ? '--id' : idResolution.source;

    if (!tenantId) {
        tenantId = crypto.randomUUID();
        idSource = 'generado (UUID v4)';
    }

    json.id = tenantId;
    report.resolved.push({ field: 'id', source: idSource });

    for (const spec of contract) {
        if (spec.dtoKey !== spec.field) {
            report.drift.push(spec);
        }

        const resolution = resolveValue(spec, env);

        if (resolution.value === null) {
            const entry = { ...spec, candidates: resolution.candidates, placeholder: resolution.placeholder };
            if (spec.nullable) {
                report.missingOptional.push(entry);
                if (options.includeEmpty) {
                    json[spec.field] = null;
                }
            } else {
                report.missingRequired.push(entry);
            }
            continue;
        }

        if (spec.type === 'int') {
            const parsed = Number(resolution.value);
            if (!Number.isInteger(parsed)) {
                report.invalid.push({
                    ...spec,
                    source: resolution.source,
                    value: resolution.value,
                    reason: 'se esperaba un entero (ValueObjectInt)',
                });
                continue;
            }
            json[spec.field] = parsed;
        } else {
            json[spec.field] = resolution.value;
        }

        report.resolved.push({ field: spec.field, source: resolution.source });
    }

    return { json, report };
}

/**
 * Convierte el JSON plano del tenant al formato AttributeValue de DynamoDB.
 * El tenant solo contiene strings, enteros y (con --include-empty) nulos, así que
 * basta con S / N / NULL; se cubre BOOL por si un campo futuro lo necesita.
 * @param {Record<string, string|number|null>} json
 * @returns {Record<string, Object>}
 */
function marshallToDynamoDb(json) {
    const item = {};

    for (const [key, value] of Object.entries(json)) {
        if (value === null || value === undefined) {
            item[key] = { NULL: true };
        } else if (typeof value === 'number') {
            item[key] = { N: String(value) };
        } else if (typeof value === 'boolean') {
            item[key] = { BOOL: value };
        } else {
            item[key] = { S: String(value) };
        }
    }

    return item;
}

/**
 * Imprime el reporte de validación en stderr.
 * @param {Object} report
 * @param {Array<Object>} contract
 * @param {string} envFile
 */
function printReport(report, contract, envFile) {
    const required = contract.filter((field) => !field.nullable).length;

    out('');
    out(paint('bold', 'Contrato leído de Tenant.js'));
    out(
        paint(
            'gray',
            `  ${path.relative(PROJECT_ROOT, TENANT_ENTITY_PATH)} → ${contract.length} campos ` +
                `(${required} requeridos, ${contract.length - required} opcionales)`
        )
    );
    out(paint('gray', `  dotenv: ${envFile}`));
    out('');
    out(`${paint('green', '✓')} ${report.resolved.length} campos resueltos`);

    if (report.missingOptional.length > 0) {
        out(`${paint('yellow', '⚠')} ${report.missingOptional.length} opcionales sin valor (se omiten del JSON):`);
        for (const field of report.missingOptional) {
            const note = field.placeholder ? ' [placeholder ignorado]' : '';
            out(paint('gray', `    - ${field.field}  ← ${field.candidates.join(' | ')}${note}`));
        }
    }

    if (report.drift.length > 0) {
        out(`${paint('yellow', '⚠')} ${report.drift.length} campos donde Tenant.js lee una clave distinta del dto:`);
        for (const field of report.drift) {
            out(paint('yellow', `    - #${field.field} se inicializa con dto.${field.dtoKey}`));
        }
        out(paint('gray', '      El JSON usa el nombre del campo; revisa si es un bug de la entidad.'));
    }

    if (report.invalid.length > 0) {
        out(`${paint('red', '✗')} ${report.invalid.length} valores inválidos:`);
        for (const field of report.invalid) {
            out(paint('red', `    - ${field.field} = "${field.value}" (${field.source}): ${field.reason}`));
        }
    }

    if (report.missingRequired.length > 0) {
        out(`${paint('red', '✗')} ${report.missingRequired.length} requeridos sin valor:`);
        for (const field of report.missingRequired) {
            const note = field.placeholder ? ' [placeholder ignorado]' : '';
            out(paint('red', `    - ${field.field}  ← ${field.candidates.join(' | ')}${note}`));
        }
        out(
            paint('gray', '      Define esas variables en el dotenv o agrega un alias en ENV_OVERRIDES de este script.')
        );
    }

    out('');
}

function main() {
    let options;
    try {
        options = parseArgs(process.argv.slice(2));
    } catch (error) {
        out(paint('red', error.message));
        out(HELP);
        process.exit(1);
    }

    if (options.help) {
        out(HELP);
        return;
    }

    const envFile = path.resolve(options.envFile ?? path.join(PROJECT_ROOT, '.env'));
    if (!fs.existsSync(envFile)) {
        out(paint('red', `No existe el archivo dotenv: ${envFile}`));
        process.exit(1);
    }
    if (!fs.existsSync(TENANT_ENTITY_PATH)) {
        out(paint('red', `No se encontró la entidad Tenant en: ${TENANT_ENTITY_PATH}`));
        process.exit(1);
    }

    const contract = extractTenantContract(fs.readFileSync(TENANT_ENTITY_PATH, 'utf8'));
    const env = parseDotenv(fs.readFileSync(envFile, 'utf8'));
    const { json, report } = buildTenantJson(contract, env, options);

    printReport(report, contract, path.relative(PROJECT_ROOT, envFile) || envFile);

    const hasErrors = report.missingRequired.length > 0 || report.invalid.length > 0;
    if (hasErrors && !options.allowMissing) {
        out(paint('red', 'JSON no generado: el tenant no cumple el contrato de Tenant.js.'));
        out(paint('gray', 'Usa --allow-missing para generarlo igual (fallará al construir el Tenant).'));
        process.exit(1);
    }

    if (options.check) {
        out(paint('green', 'Contrato válido.'));
        return;
    }

    const payload = options.format === 'dynamodb' ? marshallToDynamoDb(json) : json;
    const serialized = `${JSON.stringify(payload, null, 4)}\n`;

    if (options.outFile) {
        const outFile = path.resolve(options.outFile);
        fs.writeFileSync(outFile, serialized, { mode: 0o600 });
        out(paint('green', `JSON (${options.format}) escrito en ${outFile} (contiene secretos, no lo commitees).`));
    } else {
        process.stdout.write(serialized);
    }
}

main();

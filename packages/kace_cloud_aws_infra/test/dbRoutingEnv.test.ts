import { readFileSync } from 'fs';
import { join } from 'path';

import { getDbTarget } from '../src/dbRoutingEnv';

describe('dbRoutingEnv', () => {
    it('maps non-priority service to replica', () => {
        expect(getDbTarget('cases-count')).toBe('replica');
    });
    it('maps unknown service to primary (fail-safe)', () => {
        expect(getDbTarget('nope')).toBe('primary');
    });
    it('maps cases to replica (list/count read-only — Fase 0)', () => {
        expect(getDbTarget('cases')).toBe('replica');
    });
    it('maps boards to replica (Fase 2 — board reads to replica)', () => {
        expect(getDbTarget('boards')).toBe('replica');
    });
    it('maps reports to replica', () => {
        expect(getDbTarget('reports')).toBe('replica');
    });
    it('maps case-available-states to replica (Oleada 6a)', () => {
        expect(getDbTarget('case-available-states')).toBe('replica');
    });
    it('maps case-transitions to primary', () => {
        expect(getDbTarget('case-transitions')).toBe('primary');
    });
    it('maps states-distinct to replica (Oleada 6b)', () => {
        expect(getDbTarget('states-distinct')).toBe('replica');
    });
    it('maps global-configuration-get to replica (Oleada 6b)', () => {
        expect(getDbTarget('global-configuration-get')).toBe('replica');
    });
    it('maps clients_doc_types to replica (Oleada 6b)', () => {
        expect(getDbTarget('clients_doc_types')).toBe('replica');
    });
    it('maps clients_contacts to replica (Oleada 6b)', () => {
        expect(getDbTarget('clients_contacts')).toBe('replica');
    });
    it('maps imports-dashboard to replica (Oleada 6b)', () => {
        expect(getDbTarget('imports-dashboard')).toBe('replica');
    });
    it('maps literals to replica (Oleada 7 Tier B)', () => {
        expect(getDbTarget('literals')).toBe('replica');
    });
    it('maps group-lists to replica (Oleada 7 Tier B)', () => {
        expect(getDbTarget('group-lists')).toBe('replica');
    });
    it('maps automation-settings to replica (Oleada 7 Tier B)', () => {
        expect(getDbTarget('automation-settings')).toBe('replica');
    });
    it('maps allowed-connections to replica (Oleada 7 Tier B)', () => {
        expect(getDbTarget('allowed-connections')).toBe('replica');
    });
    it('maps banners to replica (Oleada 7 Tier B)', () => {
        expect(getDbTarget('banners')).toBe('replica');
    });
    it('maps helps_attachments to replica (Oleada 7 Tier B)', () => {
        expect(getDbTarget('helps_attachments')).toBe('replica');
    });
    it('maps helps to replica (Oleada 7 Tier B)', () => {
        expect(getDbTarget('helps')).toBe('replica');
    });
    it('maps customlists to replica (Oleada 7 Tier B)', () => {
        expect(getDbTarget('customlists')).toBe('replica');
    });
    it('maps geolocation to replica (Oleada 7 Tier B)', () => {
        expect(getDbTarget('geolocation')).toBe('replica');
    });
    it('maps schemas to replica (Oleada 7 Tier B)', () => {
        expect(getDbTarget('schemas')).toBe('replica');
    });
    it('maps aux-definitions to replica (Oleada 7 Tier B)', () => {
        expect(getDbTarget('aux-definitions')).toBe('replica');
    });
    it('maps states to replica (Oleada 8)', () => {
        expect(getDbTarget('states')).toBe('replica');
    });
    it('maps transitions to replica (Oleada 8)', () => {
        expect(getDbTarget('transitions')).toBe('replica');
    });
    it('maps transition-rules to replica (Oleada 8)', () => {
        expect(getDbTarget('transition-rules')).toBe('replica');
    });
    it('maps folio-configurations to replica', () => {
        expect(getDbTarget('folio-configurations')).toBe('replica');
    });
    it('maps templates to replica (Oleada 8)', () => {
        expect(getDbTarget('templates')).toBe('replica');
    });
    it('maps template-attachments to replica (Oleada 8)', () => {
        expect(getDbTarget('template-attachments')).toBe('replica');
    });
    it('maps groups to replica (Oleada 9)', () => {
        expect(getDbTarget('groups')).toBe('replica');
    });
    it('maps roles to replica (Oleada 9)', () => {
        expect(getDbTarget('roles')).toBe('replica');
    });
    it('maps assignment-users-list to replica (Oleada 9)', () => {
        expect(getDbTarget('assignment-users-list')).toBe('replica');
    });
    it('maps client-notifications to replica (Oleada 10)', () => {
        expect(getDbTarget('client-notifications')).toBe('replica');
    });
    it('maps mail-accounts to replica (Oleada 10)', () => {
        expect(getDbTarget('mail-accounts')).toBe('replica');
    });
    it('maps comments to replica (Oleada 11)', () => {
        expect(getDbTarget('comments')).toBe('replica');
    });
    it('maps interactions to replica (Oleada 11)', () => {
        expect(getDbTarget('interactions')).toBe('replica');
    });
    it('maps emails to replica (Oleada 11)', () => {
        expect(getDbTarget('emails')).toBe('replica');
    });
    it('maps report-executions to replica (Oleada 11)', () => {
        expect(getDbTarget('report-executions')).toBe('replica');
    });
    it('maps agendas to replica (Oleada 12)', () => {
        expect(getDbTarget('agendas')).toBe('replica');
    });
    it('maps agendas-groups to replica (Oleada 12)', () => {
        expect(getDbTarget('agendas-groups')).toBe('replica');
    });
    it('maps appointments to replica (Oleada 12)', () => {
        expect(getDbTarget('appointments')).toBe('replica');
    });
    it('maps appointment-time-slots to replica (Oleada 12)', () => {
        expect(getDbTarget('appointment-time-slots')).toBe('replica');
    });
    it('maps shift-management to replica (Oleada 12)', () => {
        expect(getDbTarget('shift-management')).toBe('replica');
    });
    it('maps case-attachments to replica (Oleada 13)', () => {
        expect(getDbTarget('case-attachments')).toBe('replica');
    });
    it('maps case-descriptions to replica (Oleada 13)', () => {
        expect(getDbTarget('case-descriptions')).toBe('replica');
    });
    it('maps case-session-duration to replica (Oleada 13)', () => {
        expect(getDbTarget('case-session-duration')).toBe('replica');
    });
    it('maps global-configuration to replica (Oleada 14)', () => {
        expect(getDbTarget('global-configuration')).toBe('replica');
    });
    it('maps schema-fields to replica (Oleada 14)', () => {
        expect(getDbTarget('schema-fields')).toBe('replica');
    });
    it('maps exports to replica (Oleada 15)', () => {
        expect(getDbTarget('exports')).toBe('replica');
    });
    it('maps s3-files to replica (Oleada 15)', () => {
        expect(getDbTarget('s3-files')).toBe('replica');
    });
    it('maps cases2 to replica (Oleada 15)', () => {
        expect(getDbTarget('cases2')).toBe('replica');
    });
    it('maps broker-adapters to replica (Oleada 16)', () => {
        expect(getDbTarget('broker-adapters')).toBe('replica');
    });
    it('maps broker-mappers to replica (Oleada 16)', () => {
        expect(getDbTarget('broker-mappers')).toBe('replica');
    });
    it('maps workspaces to replica (Oleada 16)', () => {
        expect(getDbTarget('workspaces')).toBe('replica');
    });
    it('maps one_script to replica (Oleada 16)', () => {
        expect(getDbTarget('one_script')).toBe('replica');
    });
    it('maps event-logs to replica (Oleada 16)', () => {
        expect(getDbTarget('event-logs')).toBe('replica');
    });
    it('maps generate-csv to replica (Oleada 16)', () => {
        expect(getDbTarget('generate-csv')).toBe('replica');
    });
    it.each([
        'actions',
        'action-jobs',
        'action-update-model',
        'auxiliaries',
        'aux-cases',
        'aux-clients',
        'clients',
        'case-clone', // Oleada 13 — write-only cases action, explicitly excluded
        'case-close',
        'case-re-open',
        'case-reclassification',
        'global-configuration-set', // Oleada 14 — write-only config setter, explicitly excluded
        'ws-hook-rest-flows',
        'ws-rest-endpoints',
        'ws-rest-flows',
        'ws-rest-functions',
        'ws-rest-workflow-steps',
        'imports', // Oleada 15 — write-only INSERT, explicitly excluded
        'imports-processor', // Oleada 15 — transactional cron worker, explicitly excluded
        'cases-bulk', // Oleada 15 — write-only bulk cases actions, explicitly excluded
        'tempcases', // Oleada 15 — fake_cases shadow CRUD, explicitly excluded
        'tempclients', // Oleada 15 — fake_clients shadow CRUD, explicitly excluded
        'flows', // Oleada 15 — write-on-read auto-heal, pinned to writer
        'secrets-vaults', // Oleada 15 — secrets_vault CRUD, pinned to writer
        'ans-calculate', // Oleada 16 — writes cases SLA bulk, pinned to writer
        'case-calculate-ans', // Oleada 16 — read-modify-write of a case, pinned to writer
        'group_cases_assignment', // Oleada 16 — write-only case reassignment, pinned to writer
        'auth-cognito', // Oleada 16 — auth write-path, pinned to writer
        'debug-toggle', // Oleada 16 — debug flag writes + scheduler, pinned to writer
        'dashboard-counts-refresh', // Oleada 16 — REFRESH MATERIALIZED VIEW worker, pinned to writer
        'partition-maintenance', // Oleada 16 — DDL partition worker, pinned to writer
        'event-processor', // Oleada 16 — SQS/EventBridge write-heavy worker, pinned to writer
    ])("maps priority service '%s' to primary", (serviceKey) => {
        expect(getDbTarget(serviceKey)).toBe('primary');
    });
});

describe('Oleada 5 — non-priority services route to replica', () => {
    const OLEADA5_KEYS = [
        'ans',
        'classifications',
        'classifications-levels',
        'classifications-groups-relationships',
        'classifications-groups-relationships-batch',
        'classifications-groups-relationships-batch-delete',
        'classification-template-relations',
        'user-cases-assignment',
        'user-group-relationships',
        'users-notifications',
        'users',
    ];

    it.each(OLEADA5_KEYS)('maps %s to replica', (key) => {
        expect(getDbTarget(key)).toBe('replica');
    });
});

const extractServiceRouting = (source: string): Record<string, boolean> => {
    // Grab the SERVICE_DB_ROUTING object literal block, then pull each `key: { priority: <bool> }`
    // entry, capturing BOTH the key and its priority value.
    const block = source.slice(source.indexOf('SERVICE_DB_ROUTING'));
    const routing: Record<string, boolean> = {};
    const re = /['"]?([A-Za-z0-9_-]+)['"]?\s*:\s*\{\s*priority\s*:\s*(true|false)\s*\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(block)) !== null) {
        routing[m[1]] = m[2] === 'true';
    }
    return routing;
};

const ROUTING_SOURCES: Array<{ label: string; path: string }> = [
    { label: 'dbRoutingEnv.ts', path: '../src/dbRoutingEnv.ts' },
    { label: 'dbRoutingEnv.js', path: '../src/dbRoutingEnv.js' },
    { label: 'serviceDbRouting.js', path: '../../kace_cloud_api_common/src/db-routing/serviceDbRouting.js' },
];

const readRouting = (relativePath: string): Record<string, boolean> =>
    extractServiceRouting(readFileSync(join(__dirname, relativePath), 'utf8'));

describe('dbRoutingEnv mirror stays in sync with api_common registry', () => {
    const [canonical, ...mirrors] = ROUTING_SOURCES;

    // Comparación de mapa completo, no solo de keys: un servicio clasificado priority:false en un
    // registro y priority:true en otro pasaría un guard de keys y aun así rutearía mal (DB_TARGET
    // divergente). Recorre las copias en runtime en vez de enumerarlas a mano, para que una cuarta
    // copia solo tenga que añadirse a ROUTING_SOURCES.
    it.each(mirrors)('$label has the same service keys AND priority values as dbRoutingEnv.ts', ({ path }) => {
        expect(readRouting(path)).toEqual(readRouting(canonical.path));
    });

    it.each(ROUTING_SOURCES)(
        '$label yields a non-empty routing map (regex sanity — guard would silently no-op if it matched nothing)',
        ({ path }) => {
            const routing = readRouting(path);

            expect(Object.keys(routing).length).toBeGreaterThan(0);
            // Spot-check both a known non-priority and a known priority entry are captured correctly.
            expect(routing['cases-count']).toBe(false);
            expect(routing['actions']).toBe(true);
        }
    );
});

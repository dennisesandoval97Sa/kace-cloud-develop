import { Permissions } from './Permissions.js';

// IMPORTANT: This catalog is the single source of truth for advanced search permissions.
// It is mirrored in packages/kace_cloud_database/utils/RolePermisionList.js (the DB seed cannot
// import @kace/core due to a circular dependency). Both copies are kept in lockstep by the test
// "database seed search permissions match the core catalog exactly" in
// tests/role/SearchPermissionsCatalog.test.js. If you edit one array, edit the other.
// NOTE: each entry's description is load-bearing — permissionByEndpointKey() derives the endpointKey
// by parsing the "Use advanced search filters on <endpointKey>" prefix. Do not reword or localize it.
const SEARCH_PERMISSION_DEFINITIONS = [
    [
        'ActionBatchExecutionsProcessQueueSearchAdvanced',
        'Use advanced search filters on action-batch-executions.process-queue.search',
        'actions-queue-executor',
    ],
    [
        'ActionBatchExecutionsSearchAdvanced',
        'Use advanced search filters on action-batch-executions.search',
        'actions-queue-executions',
    ],
    [
        'ActionBatchExecutionsValidateCsvSearchAdvanced',
        'Use advanced search filters on action-batch-executions.validate-csv.search',
        'actions-queue-executions',
    ],
    ['ActionUpdateModelSearchAdvanced', 'Use advanced search filters on action-update-model.search', 'actions'],
    ['ActionsSearchAdvanced', 'Use advanced search filters on actions.search', 'actions'],
    ['AgendasGroupsSearchAdvanced', 'Use advanced search filters on agendas-groups.search', 'agendas-groups'],
    ['AgendasSearchAdvanced', 'Use advanced search filters on agendas.search', 'agendas'],
    [
        'AllowedConnectionsSearchAdvanced',
        'Use advanced search filters on allowed-connections.search',
        'allowed-connections',
    ],
    ['AnsSearchAdvanced', 'Use advanced search filters on ans.search', 'ans'],
    [
        'AppointmentTimeSlotsSearchAdvanced',
        'Use advanced search filters on appointment-time-slots.search',
        'appointment-time-slots',
    ],
    ['AppointmentsSearchAdvanced', 'Use advanced search filters on appointments.search', 'appointments'],
    [
        'AssignmentUsersListSearchAdvanced',
        'Use advanced search filters on assignment-users-list.search',
        'assignment-users-list',
    ],
    [
        'AutomationSettingsSearchAdvanced',
        'Use advanced search filters on automation-settings.search',
        'automation-settings',
    ],
    ['AuxClientsSearchAdvanced', 'Use advanced search filters on aux-clients.search', 'aux-clients'],
    ['AuxDefinitionsSearchAdvanced', 'Use advanced search filters on aux-definitions.search', 'aux-definitions'],
    [
        'AuxiliariesListSearchSearchAdvanced',
        'Use advanced search filters on auxiliaries.list-search.search',
        'auxiliaries',
    ],
    ['AuxiliariesListSearchAdvanced', 'Use advanced search filters on auxiliaries.list.search', 'auxiliaries'],
    ['AuxiliariesSearchAdvanced', 'Use advanced search filters on auxiliaries.search', 'auxiliaries'],
    ['BannersSearchAdvanced', 'Use advanced search filters on banners.search', 'banners'],
    ['BoardsAvailableBoardsSearchAdvanced', 'Use advanced search filters on boards.available-boards.search', 'boards'],
    ['BoardsBoardResourcesSearchAdvanced', 'Use advanced search filters on boards.board-resources.search', 'boards'],
    ['BoardsSearchAdvanced', 'Use advanced search filters on boards.search', 'boards'],
    ['BrokerMapperSearchAdvanced', 'Use advanced search filters on broker-mapper.search', 'broker_mappers'],
    ['BrokerSearchAdvanced', 'Use advanced search filters on broker.search', 'broker_adapters'],
    ['CaseAttachmentsSearchAdvanced', 'Use advanced search filters on case-attachments.search', 'case-attachments'],
    ['CaseDescriptionsSearchAdvanced', 'Use advanced search filters on case-descriptions.search', 'case-descriptions'],
    ['CaseSessionDurationSearchAdvanced', 'Use advanced search filters on case-session-duration.search', 'cases'],
    ['CasesCaseViewSearchAdvanced', 'Use advanced search filters on cases.case-view.search', 'cases'],
    ['CasesCaseVisibleSearchAdvanced', 'Use advanced search filters on cases.case-visible.search', 'cases'],
    ['CasesSearchAdvanced', 'Use advanced search filters on cases.search', 'cases'],
    ['CasesSubCasesSearchAdvanced', 'Use advanced search filters on cases.sub-cases.search', 'cases'],
    ['ChannelHubSearchAdvanced', 'Use advanced search filters on channel-hub.search', 'channel-hub'],
    [
        'ClassificationGroupRelationshipsSearchAdvanced',
        'Use advanced search filters on classification-group-relationships.search',
        'classification-group-relationships',
    ],
    [
        'ClassificationTemplateRelationsSearchAdvanced',
        'Use advanced search filters on classification-template-relations.search',
        'classification-template-relations',
    ],
    ['ClassificationsSearchAdvanced', 'Use advanced search filters on classifications.search', 'classifications'],
    [
        'ClientNotificationsSearchAdvanced',
        'Use advanced search filters on client-notifications.search',
        'client-notifications',
    ],
    ['ClientsSearchAdvanced', 'Use advanced search filters on clients.search', 'clients'],
    ['CommentsSearchAdvanced', 'Use advanced search filters on comments.search', 'comments'],
    [
        'CustomListsActiveGroupSearchAdvanced',
        'Use advanced search filters on custom-lists.active-group.search',
        'custom-lists',
    ],
    ['CustomListsSearchAdvanced', 'Use advanced search filters on custom-lists.search', 'custom-lists'],
    ['EmailsSearchAdvanced', 'Use advanced search filters on emails.search', 'emails'],
    ['EventLogsSearchAdvanced', 'Use advanced search filters on event-logs.search', 'event-logs'],
    [
        'EventLogsSearchByCaseSearchAdvanced',
        'Use advanced search filters on event-logs.search-by-case.search',
        'event-logs',
    ],
    ['FlowSearchAdvanced', 'Use advanced search filters on flow.search', 'flows'],
    [
        'FolioConfigurationsSearchAdvanced',
        'Use advanced search filters on folio-configurations.search',
        'folio-configurations',
    ],
    ['GenerateCsvSearchAdvanced', 'Use advanced search filters on generate-csv.search', 'csv-export-views'],
    ['GeolocationSearchAdvanced', 'Use advanced search filters on geolocation.search', 'geolocation'],
    [
        'GlobalConfigurationsSearchAdvanced',
        'Use advanced search filters on global-configurations.search',
        'global-configurations',
    ],
    ['GroupListsSearchAdvanced', 'Use advanced search filters on group-lists.search', 'group-list'],
    ['GroupSearchAdvanced', 'Use advanced search filters on group.search', 'groups'],
    ['HelpsAttachmentsSearchAdvanced', 'Use advanced search filters on helps-attachments.search', 'help-attachments'],
    ['HelpsSearchAdvanced', 'Use advanced search filters on helps.search', 'help'],
    ['ImportsDashboardSearchAdvanced', 'Use advanced search filters on imports-dashboard.search', 'imports-dashboard'],
    [
        'InteractionsAssociateInteractionToCasoSearchAdvanced',
        'Use advanced search filters on interactions.associate-interaction-to-caso.search',
        'interactions',
    ],
    [
        'InteractionsCandidateCasesSearchAdvanced',
        'Use advanced search filters on interactions.candidate-cases.search',
        'interactions',
    ],
    ['InteractionsSearchAdvanced', 'Use advanced search filters on interactions.search', 'interactions'],
    ['LiteralsSearchAdvanced', 'Use advanced search filters on literals.search', 'literals'],
    ['MailAccountsSearchAdvanced', 'Use advanced search filters on mail-accounts.search', 'mail-accounts'],
    ['OneScriptSearchAdvanced', 'Use advanced search filters on one-script.search', 'onescripts'],
    ['ReportExecutionsSearchAdvanced', 'Use advanced search filters on report-executions.search', 'exports'],
    ['ReportsSearchAdvanced', 'Use advanced search filters on reports.search', 'exports'],
    ['RolesSearchAdvanced', 'Use advanced search filters on roles.search', 'roles'],
    ['S3FilesSearchAdvanced', 'Use advanced search filters on s3-files.search', 's3-files'],
    ['SchemasRulesSearchAdvanced', 'Use advanced search filters on schemas.rules.search', 'schemas.rules'],
    ['SchemasSearchAdvanced', 'Use advanced search filters on schemas.search', 'schemas'],
    ['SecretsVaultSearchAdvanced', 'Use advanced search filters on secrets-vault.search', 'secrets-vault'],
    ['ShiftManagementSearchAdvanced', 'Use advanced search filters on shift-management.search', 'shift-management'],
    ['StatesSearchAdvanced', 'Use advanced search filters on states.search', 'state'],
    [
        'TemplateAttachmentsSearchAdvanced',
        'Use advanced search filters on template-attachments.search',
        'template-attachments',
    ],
    ['TemplatesSearchAdvanced', 'Use advanced search filters on templates.search', 'templates'],
    ['TransitionRulesSearchAdvanced', 'Use advanced search filters on transition-rules.search', 'transition-rules'],
    ['TransitionsSearchAdvanced', 'Use advanced search filters on transitions.search', 'transitions'],
    [
        'UploadS3FilesScanFileSearchAdvanced',
        'Use advanced search filters on upload-s3-files.scan-file.search',
        's3-files',
    ],
    [
        'UserGroupRelationsSearchAdvanced',
        'Use advanced search filters on user-group-relations.search',
        'user-group-relationships',
    ],
    [
        'UserNotificationsSearchAdvanced',
        'Use advanced search filters on user-notifications.search',
        'user-notifications',
    ],
    ['UsersSearchAdvanced', 'Use advanced search filters on users.search', 'users'],
    ['UsersSearchByNameSearchAdvanced', 'Use advanced search filters on users.search-by-name.search', 'users'],
    ['WorkspacesSearchAdvanced', 'Use advanced search filters on workspaces.search', 'workspaces'],
    ['WsRestEndpointsSearchAdvanced', 'Use advanced search filters on ws-rest-endpoints.search', 'ws-rest-endpoints'],
    ['WsRestFlowsSearchAdvanced', 'Use advanced search filters on ws-rest-flows.search', 'ws-rest-flows'],
    ['WsRestFunctionsSearchAdvanced', 'Use advanced search filters on ws-rest-functions.search', 'ws-rest-functions'],
    ['WsRestStepsSearchAdvanced', 'Use advanced search filters on ws-rest-steps.search', 'ws-rest-workflow-steps'],
];

export class SearchPermissionsCatalog {
    static definitions() {
        return SEARCH_PERMISSION_DEFINITIONS.map(
            ([name, description, moduleId]) => new Permissions(name, description, false, moduleId)
        );
    }

    static permissionByEndpointKey() {
        const PREFIX = 'Use advanced search filters on ';
        return SEARCH_PERMISSION_DEFINITIONS.reduce((map, [name, description, moduleId]) => {
            if (!description.startsWith(PREFIX)) {
                throw new Error(`SearchPermissionsCatalog: unexpected description format: "${description}"`);
            }
            const endpointKey = description.slice(PREFIX.length);
            map[endpointKey] = { module_id: moduleId, name, description };
            return map;
        }, {});
    }
}

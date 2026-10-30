export const ANS_SERVICE = "/ans";
export const LITERALS_SERVICE = "/literals";
export const CLIENT_SERVICE = "/clients";
export const SCHEDULES_SERVICE = "/shift-management";
export const FLOW_SERVICE = "/flows";
export const STATE_SERVICE = "/states";
export const TRANSITION_SERVICE = "/transitions";
export const BANNERS_SERVICE = "/banners";
export const GROUP_SERVICE = "/groups";
export const GROUP_LIST_SERVICE = "/group-lists";
export const USER_SERVICE = "/users";
export const GENERAL_SETUP_SERVICE = "/global-configuration";
export const ROLES_SERVICE = "/roles";
export const REL_USERS_GROUP_SERVICE = "/user-group-relationships";
export const VAULT_SECRETS_SERVICE = "/secrets-vaults";
export const USER_NOTIFICATIONS_SERVICE = "/users-notifications";
export const CLIENT_NOTIFICATIONS_SERVICE = "/client-notifications";
export const MAIL_ACCOUNTS_SERVICE = "/mail-accounts";
export const USER_LIST_SERVICE = "/assignment-users-list";
export const CASES_SERVICE = "/cases";
export const COMMENTS_SERVICE = "/comments";
export const HELPS_SERVICE = "/helps";
export const HELPS_ATTACHMENTS_SERVICE = "/helps_attachments";
export const TEMPLATES_SERVICE = "/templates";
export const CUSTOM_LISTS_SERVICE = "/customlists";
export const REPORTS_SERVICE = "/report-executions";
export const S3_FILES_DOWNLOAD_SERVICE = "/download-s3-files";
export const S3_FILES_UPLOAD_SERVICE = "/upload-s3-files";
export const S3_FILES_VALIDATION_SERVICE = "/scan-s3-file";
export const SCHEMA_FIELDS_SERVICE = "/schema-fields";
export const ONE_SCRIPT_SERVICE = "/one_script";
export const COGNITO_AUTHENTICATION = "/auth-cognito";
export const TEMPLATES_ATTACHMENT_SERVICE = "/template-attachments";
export const CASES_ATTACHMENT_SERVICE = "/case-attachments";
export const ACTION_UPDATE_MODEL = "/action-update-model";
export const APPOINTMENT_SERVICES = "/appointments";
export const RE_SCHEDULER_SERVICES = "/re-scheduler";
export const AGENDA_SERVICE = "/agendas";
export const AGENDA_GROUP_SERVICE = "/agendas-groups";
export const TIME_SLOT_SERVICE = "/appointment-time-slots";
export const GEOLOCATION_SERVICE = "/geolocation";
export const CASES_COUNT_BY_RESPONSABLE_SERVICE = "/cases-count-by-responsable";
export const IMPORTS_SERVICE = "/imports";
export const EXPORTS_SERVICE = "/exports";
export const GENERATECSV_SERVICE = "generate-csv";
export const WS_REST_ENDPOINTS_SERVICE = "/ws-rest-endpoints";
export const WS_REST_FLOWS_SERVICE = "/ws-rest-flows";
export const WS_REST_FUNCTIONS_SERVICE = "/ws-rest-functions";
export const WS_REST_STEPS_SERVICE = "/ws-rest-workflow-steps";
export const AUTOMATION_SETTINGS_SERVICE = "/automation-settings";
export const AUX_SCHEMAS_SERVICE = "/schemas";
export const CLASSIFICATION_TEMPLATE_RELATIONS_SERVICE = "/classification-template-relations";
export const WORKSPACES_SERICE = "/workspaces";
export const EMAILS_SERVICE = "/emails";

export const COGNITO_CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID;
export const COGNITO_REDIRECT_URI =
    import.meta.env.VITE_DEVELOPMENT === "true"
        ? import.meta.env.VITE_COGNITO_REDIRECT_URI_DEV
        : import.meta.env.VITE_COGNITO_REDIRECT_URI_PROD;

export const COGNITO_URL = import.meta.env.VITE_COGNITO_URL;

export const COGNITO_LOGIN = `${COGNITO_URL}/oauth2/authorize?identity_provider=${import.meta.env.VITE_IDENTITY_PROVIDER}&redirect_uri=${COGNITO_REDIRECT_URI}&response_type=${import.meta.env.VITE_COGNITO_RESPONSE_TYPE}&client_id=${COGNITO_CLIENT_ID}&${import.meta.env.VITE_COGNITO_SCOPE}`;

export const COGNITO_LOGOUT = `${COGNITO_URL}/logout?identity_provider=${import.meta.env.VITE_IDENTITY_PROVIDER}&redirect_uri=${COGNITO_REDIRECT_URI}&response_type=${import.meta.env.VITE_COGNITO_RESPONSE_TYPE}&client_id=${COGNITO_CLIENT_ID}&${import.meta.env.VITE_COGNITO_SCOPE}`;
export const ONESCRIPT_KONECTA_CLOUD = import.meta.env.VITE_ONESCRIPT_URL_PRO;
export const MAP_URL = (region, nameMap, apiKey) =>
    `https://maps.geo.${region}.amazonaws.com/maps/v0/maps/${nameMap}/style-descriptor?key=${apiKey}`;

export const URL_LOGO_KONECTA = import.meta.env.VITE_URL_LOGO_KONECTA;

export const TENANT_ID = import.meta.env.VITE_TENANT_ID;

export const TIMEZONE = import.meta.env.VITE_TIMEZONE || "";

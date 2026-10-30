import {
  VITE_COGNITO_CLIENT_ID,
  VITE_COGNITO_URL,
} from '#plugins/kace/env/index.js';

export const mock_kace_payload = {
  refresh_token: null,
  fingerprint: null,
  case_id: null,
  url_api: null,
  client_id: null,
  user_id: null,
  cognito_client_id: VITE_COGNITO_CLIENT_ID || null,
  cognito_url: VITE_COGNITO_URL || null,
};

/**
 * @typedef SelectLevel
 * @prop {string} key - Unique identifier for the select level
 * @prop {string} label - Label to display for the select
 * @prop {string} loadingMessage - Message to show while loading
 * @prop {string} dependsOn - Key of the parent select (null for root)
 */
/**
 * Configuration for each select level
 */
export const SELECT_LEVELS = [
  {
    key: 'model',
    label: 'Paso 1: Selecciona un modelo',
    loadingMessage: 'Cargango modelos...',
    dependsOn: null,
  },
  {
    key: 'field',
    label: 'Paso 2: Selecciona un campo',
    loadingMessage: 'Cargando campos...',
    dependsOn: 'model',
  },
  {
    key: 'option',
    label: 'Paso 3: Selecciona una opción',
    loadingMessage: 'Cargando opciones...',
    dependsOn: 'field',
  },
];

export const GLOBAL_CONFIG_PATHS = {
  SHOW_ATTACHMENTS:
    'config.global_config.layouts.application.agente.cases.show_attachments',
  SHOW_DESCRIPTION:
    'config.global_config.layouts.application.agente.cases.show_description',
  ALLOW_DESCRIPTIONS_EMPTY:
    'config.global_config.behaviors.application.agente.casos.allow_description_empty',
  LOCK_CASE_DESCRIPTION_EDIT:
    'config.global_config.behaviors.application.agente.casos.lock_case_description_edit',
  ALLOW_CASE_RECLASSIFICATION:
    'config.global_config.behaviors.application.agente.casos.allow_case_reclassification',
  SHOW_TIME_COUNTER:
    'config.global_config.layouts.application.agente.cases.show_time_counter',
  REFRESH_TAB_CASE:
    'config.global_config.layouts.application.agente.cases.refresh_tab_case',
};

export const STORE_TO_LEGACY_MAP = {
  'auth.refresh_token': 'refresh_token',
  'auth.fingerprint': 'fingerprint',
  'auth.tenant_id': 'tenant_id',
  'auth.client_id': 'client_id',
  'auth.cognito_client_id': 'cognito_client_id',
  'auth.cognito_url': 'cognito_url',
  'auth.id_token': 'id_token',
  'auth.access_token': 'access_token',
  'auth.token_type': 'token_type',
  'auth.expires_in': 'expires_in',
  'user.user_id': 'user_id',
  'user.user_data': 'user_data',
  'config.global_config': 'global_config',
  'config.cases_config': 'cases_config',
  'config.case_enable_subcases': 'case_enable_subcases',
  'config.allow_description_empty': 'allow_description_empty',
  'config.selected_group_id': 'selected_group_id',
  'config.api_url': 'url_api',
  'cases.case_id': 'case_id',
  'cases.case_data': 'case_data',
  'cases.generated_case_id': 'generated_case_id',
  'cases.case_require_state_change': 'case_require_state_change',
  'cases.solved_date': 'solved_date',
  'cases.parent_id': 'parent_id',
  'cases.is_description_created': 'is_description_created',
  'cases.allowed_files_extensions': 'allowed_files_extensions',
  'cases.quantity_files_allowed': 'quantity_files_allowed',
  'cases.maximun_size_allowed': 'maximun_size_allowed',
  'cases.attachments': 'attachments',
  'aux_case.aux_case_data': 'aux_case_data',
  'aux_case.aux_cases_schema': 'aux_cases_schema',
  'aux_case.aux_case_id': 'aux_case_id',
  'classifications.classifications': 'classifications',
  'classifications.current_classification': 'current_classification',
  'oneScript.one_script_form_id': 'one_script_form_id',
  'oneScript.one_script_form_data': 'one_script_form_data',
  'oneScript.one_script_schema_api': 'one_script_schema_api',
  'oneScript.schema_id': 'schema_id',
  'oneScript.validation_schema': 'validation_schema',
  'oneScript.components_schema': 'components_schema',
  'states.transitions_data': 'transitions_data',
  'states.current_transition': 'current_transition',
  'states.current_transition_id': 'current_transition_id',
  configuration_id_selected_group: 'configuration_id_selected_group',
  is_case_module: 'is_case_module',
};

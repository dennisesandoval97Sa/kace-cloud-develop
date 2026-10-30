import { v4 as uuidv4 } from 'uuid';

export const kaceStore = {
  configuration_id_selected_group: null,
  is_case_module: false,

  auth: {
    refresh_token: null,
    fingerprint: null,
    tenant_id: null,
    client_id: null,
    cognito_client_id: null,
    cognito_url: null,
    id_token: null,
    access_token: null,
    token_type: null,
    expires_in: null,
    handshake_params: null,
    auth_cognito_response: null,
  },

  user: {
    user_id: null,
    user_data: null,
  },

  config: {
    global_config: null,
    cases_config: null,
    case_enable_subcases: null,
    allow_description_empty: null,
    selected_group_id: null,
    api_url: null,
  },

  cases: {
    case_id: null,
    case_data: null,
    case_edit_locked: false,
    generated_case_id: null,
    case_require_state_change: null,
    solved_date: null,
    parent_id: null,
    is_description_created: false,
    allowed_files_extensions: [],
    quantity_files_allowed: 0,
    maximun_size_allowed: 0,
    attachments: [],
  },

  aux_case: {
    aux_case_data: null,
    aux_cases_schema: null,
    aux_subcases_schema: null,
    aux_case_id: null,
  },

  classifications: {
    classifications: null,
    current_classification: null,
  },

  oneScript: {
    one_script_form_id: null,
    one_script_form_data: null,
    one_script_schema_api: null,
    schema_id: null,
    validation_schema: null,
    components_schema: null,
  },

  states: {
    transitions_data: null,
    current_transition: null,
    current_transition_id: null,
  },
};

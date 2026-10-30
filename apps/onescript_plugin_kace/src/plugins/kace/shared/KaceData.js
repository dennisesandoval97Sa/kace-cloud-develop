/**
 * @fileoverview Legacy session façade for the Kace plugin and user-authored Form.io scripts.
 *
 * @deprecated For new code use {@link KaceEngine} services and {@link storeService}. This singleton
 * remains the compatibility surface for `Evaluator.evaluate` (`singleton: kace_data`) and is kept
 * in sync with the store via {@link STORE_TO_LEGACY_MAP} and `storeService.syncToLegacy()`.
 *
 * **Do not remove methods** such as `_fetchAuxLiteralList`, `_submitCaseData`, `_fetchAuxReference`,
 * or `_userCanEditCase` without auditing production form definitions and embedded scripts.
 *
 * @see `src/plugins/kace/data/constants.js` (`STORE_TO_LEGACY_MAP`)
 */
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { apiService } from '#services/apiService.js';
import SchemaBuilder from '@kace/schemabuilder/src/SchemaBuilder.js';
import { v4 as uuidv4 } from 'uuid';
import { removeKeysFromSubmissionData } from '../utils/removeKeysFromSubmissionData';
import { storeService } from '../services/storeService';
import { buildDirtyAuxiliaryPayload } from '../utils/buildDirtyAuxiliaryPayload';
import { applySaveOutcomeToSnapshot } from '../utils/applySaveOutcomeToSnapshot.js';
import {
  attachAuxiliaryReclassificationComment,
  assertAuxiliaryReclassificationReason,
  ensureAuxiliaryReclassificationTransition,
  hasAuxiliaryReclassificationIntent,
} from '../utils/attachAuxiliaryReclassificationComment.js';
import { RECLASSIFICATION_REASON_STORE_PATH } from './reclassification.constants.js';
import { httpErrorMessage } from '../utils/httpErrorMessage.js';
import { storeConditionFieldLabel } from '../utils/conditionFieldLabel.js';

/**
 * @deprecated Prefer `KaceEngine()` + `storeService`. Retained for legacy scripts and store sync.
 */
class KaceData {
  constructor() {
    this.refresh_token = null;
    this.fingerprint = null;
    this.tenant_id = null;
    this.case_id = null;
    this.client_id = null;
    this.user_id = null;
    this.url_api = null;
    this.cognito_client_id = null;
    this.cognito_url = null;
    this.id_token = null;
    this.access_token = null;
    this.token_type = null;
    this.expires_in = null;
    this.user_data = null;
    this.global_config = null;
    this.case_enable_subcases = null;
    this.cases_config = null;
    this.allow_description_empty = null;
    this.classifications = null;
    this.case_data = null;
    this.selected_group_id = null;
    this.current_classification = null;
    this.one_script_form_id = null;
    this.one_script_form_data = null;
    this.one_script_schema_api = null;
    this.schema_id = null;
    this.validation_schema = null;
    this.components_schema = null;
    this.current_transition = null;
    this.transitions_data = null;
    this.configuration_id_selected_group = null;
    this.emitEvent = null;
    this.aux_case_data = null;
    this.aux_cases_schema = null;
    this.aux_case_id = null;
    this.generated_case_id = null;
    this.current_transition_id = null;
    this.case_require_state_change = null;
    this.allowed_files_extensions = [];
    this.quantity_files_allowed = 0;
    this.maximun_size_allowed = 0;
    this.solved_date = null;
    this.parent_id = null;
    this.is_description_created = false;
    this.attachments = [];
    this.is_case_module = false;
    this._isCreatingTimer = false;
    this._createTimerPromise = null;
    this.ignore_schema_keys = [];
  }

  async _handleRefresh() {
    try {
      const refresh_token = this.refresh_token;
      if (refresh_token) {
        const configuration = {
          grant_type: 'refresh_token',
          client_id: this.cognito_client_id,
          refresh_token,
        };
        const response = await axios.post(
          `${this.cognito_url}/oauth2/token`,
          new URLSearchParams(configuration).toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }
        );

        if (response.status === 200 && response.data) {
          this.id_token = response.data.id_token;
          this.access_token = response.data.access_token;
          this.token_type = response.data.token_type;
          this.expires_in = response.data.expires_in;
        }
      }
    } catch (error) {
      throw new Error(`Error al actualizar el token: ${error.message}`);
    }
  }

  async _validateToken() {
    try {
      if (!this.id_token) {
        await this._handleRefresh();
        return;
      }

      const decoded = jwtDecode(this.id_token);
      const expiration_id_token_date = decoded.exp * 1000;
      const currentTime = Date.now();
      const timeLeft = expiration_id_token_date - currentTime;

      if (timeLeft <= 0 || timeLeft <= 10000) {
        await this._handleRefresh();
      }
    } catch (error) {
      throw new Error(`Error validando el token: ${error.message}`);
    }
  }

  async _fetchUserData() {
    try {
      const response = await apiService.post(`${this.url_api}/auth-cognito`, {
        access_token: this.access_token,
        expires_in: this.expires_in,
        id_token: this.id_token,
        refresh_token: this.refresh_token,
        token_type: this.token_type,
      });

      if (response.status === 200 && response.data) {
        this.user_data = response.data.data;
        this.selected_group_id = this.user_data.user.grupo_activo;
        const group_configuration = this.user_data.groups.find(
          (group) => group.id === this.selected_group_id
        );
        this.configuration_id_selected_group =
          group_configuration.configuration_id;
      }
    } catch (error) {
      throw new Error(
        `Error al obtener los datos del usuario ${error.message}`
      );
    }
  }

  async _getTransitionsData() {
    try {
      const response = await apiService.get(
        `${this.url_api}/case-transitions/${this.case_id}`
      );

      if (response.status === 200 && response.data) {
        return response.data.data;
      }
    } catch (error) {
      throw new Error(`Error al crear el temporizador: ${error.message}`);
    }
  }

  async _fetchEndpointData(endpoint) {
    try {
      if (!endpoint) {
        throw new Error('El endpoint es requerido');
      }

      const normalizedEndpoint = endpoint.startsWith('/')
        ? endpoint
        : `/${endpoint}`;

      const response = await apiService.get(
        `${this.url_api}${normalizedEndpoint}`,
        {
          filter: [],
          limit: 0,
          offset: 0,
        }
      );

      if (response.status === 200 && response.data) {
        return response.data;
      }

      return null;
    } catch (error) {
      throw new Error(
        `Error al obtener datos de ${endpoint}: ${error.message}`
      );
    }
  }

  async _fetchOptions(parentId = null) {
    try {
      const response = await kace_data._fetchAuxReference(parentId);

      if (response?.data?.items) {
        return response.data.items;
      }

      return [];
    } catch (error) {
      throw new Error(`Error al obtener las opciones: ${error.message}`);
    }
  }

  async _updateState(transition_id) {
    const aux_case = this.case_data?.aux_case?.caso_id;
    const payload = {
      case: {
        transicion_id: transition_id,
      },
      aux_cases: {},
    };
    try {
      const response = await apiService.post(
        `${this.url_api}/cases/auxiliary/${this.case_id}`,
        payload
      );

      if (response.status === 200 && response.data) {
        return response.data.data.items;
      }
    } catch (error) {
      throw new Error(
        `Error al actualizar estados: ${this._handlerErrorMessage(error)}`
      );
    }
  }

  async _getCaseAvailableStates() {
    try {
      const response = await apiService.get(
        `${this.url_api}/case-available-states/${this.case_id}`
      );

      if (response.status === 200 && response.data) {
        return response.data.data.items;
      }
    } catch (error) {
      throw new Error(`Error al obtener las opciones: ${error.message}`);
    }
  }

  async _createTimer() {
    if (this._isCreatingTimer && this._createTimerPromise) {
      return this._createTimerPromise;
    }

    this._isCreatingTimer = true;
    this._isCreatingTimer = true;
    this._createTimerPromise = (async () => {
      const payload = {
        case_id: this.case_id,
        event_type: 'VIEW',
        justification: '',
      };

      this._createTimerPromise = (async () => {
        try {
          const response = await apiService.post(
            `${this.url_api}/case-session-duration`,
            payload
          );

          if (response.status === 201 && response.data) {
            return response.data;
          }
        } catch (error) {
          throw new Error(`Error creating timer: ${error.message}`);
        } finally {
          setTimeout(() => {
            this._isCreatingTimer = false;
            this._createTimerPromise = null;
          }, 1000);

          await this._getCaseSessionId();
        }
      })();
    })();

    return this._createTimerPromise;
  }

  async _getCaseSessionId() {
    try {
      const response = await apiService.post(
        `${this.url_api}/case-session-duration/search?caseId=${this.case_id}`
      );

      if (response.status === 200 && response.data) {
        return response.data;
      }

      return null;
    } catch (error) {
      throw new Error(`Error testing this: ${error.message}`);
    }
  }

  async _getOpenCaseSession() {
    const sessionData = await this._getCaseSessionId();
    const items = sessionData?.data?.items || [];

    const openSessions = items.filter((item) => {
      const hasNoFinishedAt =
        item.finished_at === null || item.finished_at === undefined;
      const hasNoEventType =
        item.event_type === null || item.event_type === undefined;
      const hasNoJustification =
        item.justification === null || item.justification === undefined;

      return hasNoFinishedAt && hasNoEventType && hasNoJustification;
    });

    if (!openSessions.length) {
      return null;
    }
    if (!openSessions.length) {
      return null;
    }
    if (!openSessions.length) {
      return null;
    }

    openSessions.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    openSessions.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    openSessions.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return openSessions[0];
  }

  async _updateTimer({
    next_event_type,
    justification = '',
    caseSessionId = null,
  }) {
    const payload = {
      justification: justification || '',
      next_event_type,
    };

    try {
      let targetSessionId = caseSessionId;

      if (!targetSessionId) {
        const openSession = await this._getOpenCaseSession();

        if (!openSession) {
          throw new Error('No hay una sesión de caso abierta para actualizar.');
        }

        targetSessionId = openSession.id;
      }

      const response = await apiService.post(
        `${this.url_api}/case-session-duration/${targetSessionId}`,
        payload
      );

      if (response.status === 200 && response.data) {
        return response.data;
      }
      if (response.status === 200 && response.data) {
        return response.data;
      }

      return null;
    } catch (error) {
      throw new Error(`Error updating timer: ${error.message}`);
    } finally {
      await this._getCaseSessionId();
    }
  }

  async _fetchAuxMotivos(endpoint) {
    try {
      const response = await apiService.get(
        `${this.url_api}/auxiliaries/${endpoint || 'motivos_pausa'}/list`,
        {
          filter: [],
          limit: 0,
          offset: 0,
        }
      );

      if (response.status === 200 && response.data) {
        return response.data.data;
      }
    } catch (error) {
      throw new Error(`Error al obtener datos de aux_motivos`);
    }
  }

  async _fetchAuxiliaryData(entity, field, filter = null) {
    try {
      if (!entity || !field) {
        throw new Error('La entidad y el campo son obligatorios');
      }

      let response;

      if (!filter) {
        response = await apiService.get(
          `${this.url_api}/auxiliaries/${entity}/list?field=${field}`
        );
      } else {
        const filterPayload = {
          filter: [
            {
              field: 'data',
              operator: 'jsonContains',
              value: JSON.stringify({ [filter.path]: filter.value }),
              type: 'AND',
            },
          ],
          limit: 0,
          offset: 0,
        };
        response = await apiService.post(
          `${this.url_api}/auxiliaries/${entity}/list/search?field=${field}`,
          filterPayload
        );
      }

      if (response.status === 200 && response.data) {
        return response.data.data || [];
      }

      return [];
    } catch (error) {
      throw new Error(
        `Error al obtener datos auxiliares de: ${entity}: ${error.message}`
      );
    }
  }

  async _fetchCustomListsById(id) {
    try {
      const response = await apiService.get(
        `${this.url_api}/customlists/${id}`
      );

      if (response.status === 200 && response.data) {
        return response.data;
      }

      return null;
    } catch (error) {
      console.error(`Error fetching data from :`, error);
      throw new Error(`Error fetching data from: ${error.message}`);
    }
  }
  async _fetchAuxReference(id) {
    try {
      const response = await apiService.post(
        `${this.url_api}/literals/search`,
        {
          filter: [
            {
              field: 'tipo_literal',
              operator: id ? 'eq' : 'null',
              type: 'AND',
              value: id || 'null',
            },
            {
              field: 'is_active',
              operator: 'eq',
              type: 'AND',
              value: '1',
            },
            {
              field: 'deleted_at',
              operator: 'null',
              type: 'AND',
              value: 'null',
            },
          ],
          limit: 0,
          offset: 0,
          order: {
            direction: 'desc',
            field: 'created_at',
          },
          relationship: null,
        }
      );

      if (response.status === 200 && response.data) {
        return response.data;
      }

      return null;
    } catch (error) {
      console.error(`Error fetching data from :`, error);
      throw new Error(`Error al obtener datos: ${error.message}`);
    }
  }

  async _fetchCaseData(caseId = null) {
    try {
      if (caseId || this.case_id) {
        const response = await apiService.get(
          `${this.url_api}/cases/${caseId ?? this.case_id}`
        );
        if (response.status === 200 && response.data) {
          if (this.case_id) {
            this.case_data = response.data.data;
            this.current_transition_id = this.case_data.transicion_id;
            this.solved_date = this.case_data.fecha_resolucion;
            this.parent_id = this.case_data.parent_id;
          }
          return response.data.data;
        }
      }
    } catch (error) {
      throw new Error(`Error al obtener los datos del caso: ${error.message}`);
    }
  }

  async _fetchGlobalConfigurationData() {
    try {
      const response = await apiService.get(
        `${this.url_api}/global-configuration/${this.configuration_id_selected_group}`
      );

      if (response.status === 200 && response.data) {
        this.global_config = response.data.data.settings;
        this.cases_config =
          this.global_config?.layouts?.application?.agente?.cases;
        this.case_enable_subcases =
          this.global_config?.behaviors?.application?.agente?.casos
            ?.case_enable_subcases ?? false;
        this.allow_description_empty =
          this.global_config?.behaviors?.application?.agente?.casos
            ?.allow_description_empty ?? false;
        this.case_require_state_change =
          this.global_config?.behaviors?.application?.agente?.casos
            ?.case_require_state_change ?? false;
        this.allowed_files_extensions =
          this.global_config?.behaviors?.application?.agente?.files_extensions?.allowed_file_extensions;
        this.allowed_files_extensions =
          this.global_config?.behaviors?.application?.agente?.files_extensions?.allowed_file_extensions;
        this.quantity_files_allowed =
          this.global_config?.behaviors?.application?.agente?.files_extensions?.quantity_files_allowed;
        this.maximun_size_allowed =
          this.global_config?.behaviors?.application?.agente?.files_extensions?.maximun_size_allowed;
        if (this.emitEvent) {
          this.emitEvent('kaceAttachmentsLoading', false);
        }
      }
    } catch (error) {
      throw new Error(
        `Error al obtener los datos de configuración global: ${error.message}`
      );
    }
  }

  async _fetchGroupClassification() {
    try {
      let case_parent_data = {};

      if (this.parent_id) {
        case_parent_data = await this._fetchCaseData(this.parent_id);
      }

      const classification_parent_id =
        case_parent_data?.clasificacion_id ?? null;

      const filter = [
        {
          field: 'classification_group_relationships.group_id',
          operator: 'eq',
          value: this.user_data.user.grupo_activo,
          type: 'AND',
        },
        {
          field: 'clasificaciones.is_active',
          operator: 'eq',
          value: 1,
          type: 'AND',
        },
        {
          field: 'clasificaciones.can_start_sub_cases_flow',
          operator: 'eq',
          value: 'true',
          type: 'AND',
        },
        {
          field: 'clasificaciones.deleted_by',
          value: 'null',
          type: 'AND',
          operator: 'null',
        },
      ];

      const relationship = [
        {
          table: 'classification_group_relationships',
          condition: {
            column: 'clasificaciones.id',
            refColumn: 'classification_group_relationships.classification_id',
          },
          type: 'join',
        },
      ];

      let response;

      if (classification_parent_id) {
        response = await apiService.get(
          `${this.url_api}/classifications/${classification_parent_id}`
        );
      } else {
        response = await apiService.post(
          `${this.url_api}/classifications/search`,
          {
            filter,
            limit: 0,
            offset: 0,
            order: {
              direction: 'desc',
              field: 'created_at',
            },
            relationship,
          }
        );
      }

      if (response.status === 200 && response.data) {
        const raw_classifications = classification_parent_id
          ? response.data.data?.relations
          : response.data.data.items;
        if (
          Array.isArray(this.classifications) &&
          this.classifications.length > 0
        ) {
          this.classifications = [
            ...this.classifications,
            ...raw_classifications,
          ];
        } else {
          this.classifications = raw_classifications;
        }
      }
    } catch (error) {
      throw new Error(
        `Error al obtener los datos de clasificaciones de grupo: ${error.message}`
      );
    }
  }

  async _fetchCaseClassification() {
    try {
      if (this.case_data) {
        const response = await apiService.post(
          `${this.url_api}/classifications/search`,
          {
            filter: [
              {
                field: 'clasificaciones.id',
                operator: 'eq',
                value: this.case_data.clasificacion_id,
                type: 'AND',
              },
              {
                field: 'clasificaciones.deleted_by',
                value: 'null',
                type: 'AND',
                operator: 'null',
              },
            ],
            limit: 1,
            offset: 0,
          }
        );
        if (response.status === 200 && response.data) {
          if (
            Array.isArray(this.classifications) &&
            this.classifications.length > 0
          ) {
            this.classifications = [
              ...response.data.data.items,
              ...this.classifications,
            ];
          } else {
            this.classifications = response.data.data.items;
          }
        }
      }
    } catch (error) {
      throw new Error(
        `Error al obtener los datos de clasificación de casos: ${error.message}`
      );
    }
  }

  async _fetchCaseDescription() {
    try {
      if (this.case_data && this.case_data?.descripcion_caso_id) {
        const response = await apiService.get(
          `${this.url_api}/case-descriptions/${this.case_data.descripcion_caso_id}`
        );
        if (response.status === 200 && response.data) {
          this.case_data.descripcion_caso = response.data.data.descripcion;
          this.is_description_created = Boolean(response.data.data.id);
        }
      } else {
        this.case_data = { ...this.case_data, descripcion_caso: '' };
      }
      if (this.emitEvent) {
        this.emitEvent('kaceDescriptionLoading', false);
      }
    } catch (error) {
      throw new Error(
        `Error al obtener los datos de descripción del caso: ${error.message}`
      );
    }
  }

  async _fetchClassificationsGroupsRelationship(classification_id) {
    try {
      const current_classification_id =
        classification_id ?? this.case_data?.clasificacion_id ?? null;
      const current_group_id =
        this.case_data?.grupo_id ?? this.user_data?.user?.grupo_activo;
      if (current_classification_id && current_group_id) {
        const response = await apiService.post(
          `${this.url_api}/classifications-groups-relationships/search`,
          {
            filter: [
              {
                field: 'classification_id',
                operator: 'eq',
                value: current_classification_id,
                type: 'AND',
              },
              {
                field: 'group_id',
                operator: 'eq',
                value: current_group_id,
                type: 'AND',
              },
            ],
            limit: 0,
            offset: 0,
            order: {
              field: 'form',
              direction: 'desc',
            },
            relationship: null,
          }
        );
        if (response.status === 200 && response.data) {
          this.current_classification = response.data.data.items[0];
          this.one_script_form_id = response.data.data.items[0]?.form;
        }
      }
    } catch (error) {
      throw new Error(
        `Error al obtener los datos de relación del grupo de clasificación ${error.message}`
      );
    }
  }

  async _fetchOneScriptData() {
    try {
      if (this.one_script_form_id) {
        const response = await apiService.get(
          `${this.url_api}/one_script/${this.one_script_form_id}`
        );
        if (response.status === 200 && response.data) {
          this.one_script_form_data = response.data.data;
          this.schema_id = response.data.data.schema_id;
          this.one_script_schema_api = response.data.data.url_api;
          await this._fetchValidationSchema();
        }
      }
    } catch (error) {
      throw new Error(`Error al obtener datos de un script:: ${error.message}`);
    }
  }

  async _fetchValidationSchema() {
    try {
      if (!this.is_case_module && this.schema_id) {
        const data_structure = await this._fetchAuxSchema(this.schema_id);

        this.validation_schema = { ...data_structure };
        return;
      }

      if (this.schema_id && this.aux_cases_schema) {
        const aux_cases_data_structure =
          this.aux_cases_schema?.data_structure ?? {};
        const found = Object.entries(aux_cases_data_structure).find(
          ([_, v]) => v?.schema_id === this.schema_id
        );

        if (found) {
          const [key, value] = found;
          this.validation_schema = { data_structure: { [key]: value } };
        } else {
          this.validation_schema = null;
          throw new Error(
            'No se encontró la estructura de datos en aux_cases para el esquema proporcionado.'
          );
        }
      }
    } catch (error) {
      throw new Error(
        `Error al obtener el esquema de validación: ${error.message}`
      );
    }
  }

  async _fetchFormSchema() {
    try {
      if (this.one_script_schema_api) {
        const response = await apiService.get(this.one_script_schema_api, {
          kace_request: false,
        });
        if (response.status === 200 && response.data) {
          this.components_schema = response.data.schemaData.components;
        }
      }
    } catch (error) {
      throw new Error(
        `Error al obtener el esquema del formulario: ${error.message} (El esquema no está relacionado con aux_cases)`
      );
    }
  }

  async _fetchCurrentTransitionData(transition_id) {
    try {
      const current_transition_id =
        transition_id ?? this.case_data?.transicion_id ?? null;
      if (current_transition_id) {
        const response = await apiService.get(
          `${this.url_api}/transitions/${current_transition_id}`
        );
        if (response.status === 200 && response.data) {
          this.current_transition = response.data.data;
        }
      }
    } catch (error) {
      throw new Error(
        `Error al obtener datos de transiciones: ${error.message}`
      );
    }
  }

  async _fetchTransitionsData(flow_id) {
    try {
      const current_flow_id =
        flow_id ?? this.current_transition?.flujo_id ?? null;
      if (current_flow_id) {
        const response = await apiService.post(
          `${this.url_api}/transitions/search`,
          {
            filter: [
              {
                field: 'transiciones.flujo_id',
                operator: 'eq',
                value: current_flow_id,
                type: 'AND',
              },
              {
                field: 'transiciones.is_visible',
                operator: 'eq',
                value: 'true',
                type: 'AND',
              },
            ],
            limit: 0,
            offset: 0,
            order: {
              direction: 'desc',
              field: 'transiciones.created_at',
            },
            relationship: null,
          }
        );
        if (response.status === 200 && response.data) {
          this.transitions_data = response.data.data.items;
        }
      }
    } catch (error) {
      throw new Error(`Error fetching transitions data: ${error.message}`);
    }
  }

  async _fetchStateName(state_id) {
    try {
      if (!state_id) return null;
      const response = await apiService.get(
        `${this.url_api}/states/${state_id}`
      );
      if (response.status === 200 && response.data) {
        return response.data.data.nombre ?? 'Unknown State';
      }
      return 'Unknown State';
    } catch (error) {
      console.error(`Error fetching state name: ${error.message}`);
      return 'Unknown State';
    }
  }

  async _fetchAuxCase() {
    try {
      if (this.case_data.id) {
        const response = await apiService.get(
          `${this.url_api}/aux-cases/${this.case_data.id}`
        );
        if (response.status === 200 && response.data) {
          this.aux_case_data = response.data.data.data;
          this.aux_case_id = response.data.data.id;
        }
      }
    } catch (error) {
      throw new Error(`Error fetching aux case: ${error.message}`);
    }
  }

  async _fetchAuxCasesSchema() {
    try {
      const response = await apiService.get(`${this.url_api}/aux-definitions`);
      if (response.status === 200 && response.data) {
        const definitions = response.data.data.items ?? [];
        const casesSchema = definitions.find((item) => item.name === 'cases');
        const res = await apiService.get(
          `${this.url_api}/schemas/${casesSchema.schema_id}/rules`
        );
        if (res.status === 200 && res.data) {
          this.aux_cases_schema = res.data.data;
        }
      }
    } catch (error) {
      throw new Error(`Error fetching aux case: ${error.message}`);
    }
  }

  async _fetchAuxSchema(schema_id) {
    try {
      if (schema_id) {
        const res = await apiService.get(
          `${this.url_api}/schemas/${schema_id}/rules`
        );
        if (res.status === 200 && res.data) {
          return res.data.data;
        }
      }
    } catch (error) {
      throw new Error(`Error fetching aux case: ${error.message}`);
    }
  }

  async _submitCaseData(caseData, description) {
    try {
      const case_id = this.case_id;
      if (!case_id && !this.generated_case_id && caseData?.case?.id) {
        this.generated_case_id = caseData.case.id;
      }
      // Creates upload attachments before the POST so created.case actions
      // (e.g. email templates sending case attachments) can see them; the
      // backend accepts the pre-generated id after a collision check.
      const uploadBeforeSubmit =
        !case_id && (this.generated_case_id || caseData?.case?.id);
      const url = case_id
        ? `${this.url_api}/cases/auxiliary/${case_id}?override=true`
        : `${this.url_api}/cases/auxiliary`;
      let liveForRefresh = null;
      if (case_id) {
        // Se borra sobre una copia: `caseData` es la submission viva del formulario y un guardado
        // fallido la dejaría sin id, así que el reintento no sabría qué caso actualizar.
        caseData = {
          ...caseData,
          case: { ...caseData.case },
          aux_cases: { ...caseData.aux_cases },
        };
        delete caseData.case.id;
        delete caseData.aux_cases.caso_id;
        const parentId = storeService.get('cases.case_id');
        const shouldRecorte = Boolean(
          case_id && parentId && String(case_id) === String(parentId)
        );
        const lockCaseDescriptionEdit =
          this.global_config?.behaviors?.application?.agente?.casos
            ?.lock_case_description_edit === true;
        if (shouldRecorte) {
          const snapshot = storeService.get('cases.edit_snapshot');
          liveForRefresh = {
            case: caseData.case ?? {},
            aux_cases: caseData.aux_cases ?? {},
            description,
          };
          const dirty = buildDirtyAuxiliaryPayload(liveForRefresh, snapshot);
          caseData = {
            case: dirty.case,
            aux_cases: dirty.aux_cases,
            ...(dirty.description ? { description: dirty.description } : {}),
          };
        } else if (!lockCaseDescriptionEdit) {
          caseData.description = {
            id: caseData.case.descripcion_caso_id,
            descripcion: description,
          };
        }
        if (lockCaseDescriptionEdit) {
          delete caseData.description;
        }
      } else {
        if (!Object.entries(caseData.aux_cases).length) {
          caseData.aux_cases = {
            caso_id: caseData.case.id,
            data: {},
          };
        }
        caseData.description = {
          id: caseData.case.descripcion_caso_id,
          descripcion: description,
        };
      }

      const keysToIgnore = this.ignore_schema_keys ?? [];
      let payload =
        keysToIgnore.length > 0
          ? (() => {
              const cloned = JSON.parse(JSON.stringify(caseData ?? {}));
              removeKeysFromSubmissionData(cloned, keysToIgnore);
              return cloned;
            })()
          : (caseData ?? {});

      const reason = storeService.get(RECLASSIFICATION_REASON_STORE_PATH);
      assertAuxiliaryReclassificationReason(payload, reason);
      payload = attachAuxiliaryReclassificationComment(payload, reason);
      payload = ensureAuxiliaryReclassificationTransition(payload, {
        live: liveForRefresh?.case?.transicion_id,
        storeTransition: storeService.get('states.current_transition')
          ?.transition_id,
        snapshot: storeService.get('cases.edit_snapshot')?.case?.transicion_id,
      });

      const uploadPendingAttachments = async () => {
        if (!this.attachments.length) return;

        const mappedAttachments = this.attachments
          .filter((element) => !element.id)
          .map((attachment) =>
            this._uploadFile({
              contentType: attachment.description,
              fileName: attachment.path,
              file: attachment.file,
              fileTypeNumeric: attachment.attachmentType ?? null,
              fileTypeCategory: attachment.tipoFoto?.label ?? null,
            })
          );

        await Promise.all(mappedAttachments);
      };

      if (uploadBeforeSubmit) {
        await uploadPendingAttachments();
      }

      const response = await apiService.post(url, payload);
      // El motivo ya viajó en este POST; dejarlo lo reenviaría en un reintento.
      if (
        payload?.comment != null ||
        hasAuxiliaryReclassificationIntent(payload?.case)
      ) {
        storeService.set(RECLASSIFICATION_REASON_STORE_PATH, null);
      }
      if (liveForRefresh) {
        applySaveOutcomeToSnapshot(storeService, liveForRefresh, response);
      }

      // Adopt the server-confirmed id before any follow-up script logic runs.
      const createdCaseId =
        response?.data?.data?.case?.id ?? response?.data?.data?.id ?? null;
      if (!case_id && createdCaseId) {
        this.case_id = createdCaseId;
      }

      if (!uploadBeforeSubmit) {
        await uploadPendingAttachments();
      }

      return response;
    } catch (error) {
      throw new Error(
        `Error guardando el caso: ${this._handlerErrorMessage(error)}`
      );
    }
  }

  async _getClassifications() {
    try {
      await this._fetchCaseClassification();
      if (!kace_data.case_data?.parent_id) {
        await this._fetchGroupClassification();
      }
      if (this.emitEvent) {
        this.emitEvent('kaceClassificationsLoading', false);
        const classificationsToEmit = this.classifications || [];
        this.emitEvent('kaceClassificationsData', classificationsToEmit);
      }
    } catch (error) {
      if (this.emitEvent) {
        this.emitEvent('kaceClassificationsLoading', false);
      }
      throw new Error(`Error getting classifications: ${error.message}`);
    }
  }

  async _getSchema(classification_id = null, is_case_module = false) {
    try {
      this.is_case_module = is_case_module;
      await this._fetchClassificationsGroupsRelationship(classification_id);
      await this._fetchOneScriptData();
      await this._fetchFormSchema();
    } catch (error) {
      console.error(`Error getting schema: ${error.message}`);
      throw new Error(`Error getting schema: ${error.message}`);
    }
  }

  async _getStatesData(transition_id = null, flow_id = null) {
    try {
      await this._fetchCurrentTransitionData(transition_id);
      await this._fetchTransitionsData(flow_id);
      if (this.emitEvent) {
        this.emitEvent('kaceStatesLoading', false);
      }
    } catch (error) {
      throw new Error(`Error getting states data: ${error.message}`);
    }
  }

  async _createCase(case_data, description) {
    try {
      removeKeysFromSubmissionData(case_data);
      await this._submitCaseData(case_data, description);

      if (!this.case_id && case_data.case?.id) {
        this.case_id = case_data.case.id;
      }
    } catch (error) {
      throw new Error(error.message);
    }
  }

  _handlerErrorMessage(error) {
    return httpErrorMessage(error, {
      fieldLabel: storeConditionFieldLabel(storeService),
    });
  }

  async _caseFieldsValidation(case_data, description) {
    const solved_date_case = kace_data.solved_date;
    const case_payload = case_data?.case ?? null;
    let aux_case_payload = null;
    if (
      case_data?.aux_cases?.data &&
      typeof case_data.aux_cases.data === 'object'
    ) {
      const keys = Object.keys(case_data.aux_cases.data);
      if (keys.length === 1) {
        aux_case_payload = case_data.aux_cases.data[keys[0]];
      } else {
        aux_case_payload = case_data.aux_cases.data;
      }
    }

    const translation = {
      cliente_id: 'cliente',
      transicion_id: 'estados',
      clasificacion_id: 'clasificación',
      responsable_id: 'responsable',
      descripcion_caso_id: 'descripción',
      grupo_id: 'grupo',
      parent_id: 'caso padre',
    };

    if (solved_date_case)
      throw new Error('El caso ya esta resuelto y no es posible actualizar');
    if (!case_payload) throw new Error('Los campos del caso son requeridos');
    if (!aux_case_payload)
      throw new Error('Los campos del auxiliar de caso son requeridos');

    if (
      this.current_transition_id === case_payload.transicion_id &&
      this.case_require_state_change
    ) {
      throw new Error(
        'Debe cambiar el estado para poder actualizar el caso, consulte las configuraciones globales del grupo'
      );
    }

    if (
      (!description || description === '<br>') &&
      !this.allow_description_empty
    ) {
      throw new Error(
        'No se permite la descripción vacia, consulte las configuraciones globales del grupo'
      );
    }

    const requiresTransition = !this.case_id || this.case_require_state_change;
    if (
      !requiresTransition &&
      !case_payload.transicion_id &&
      this.current_transition_id
    ) {
      // Sin cambio de estado exigido: el payload debe seguir llevando la transición
      // vigente, no null — el widget de estados no siempre la repuebla a tiempo.
      case_payload.transicion_id = this.current_transition_id;
    }
    const emptyFields = Object.entries(case_payload)
      .filter(
        ([key, value]) =>
          key !== 'parent_id' &&
          (key !== 'transicion_id' || requiresTransition) &&
          (value === undefined || value === null || value === '')
      )
      .map(([key]) => translation[key] ?? key);

    if (emptyFields.length > 0) {
      const message =
        emptyFields.length === 1
          ? `El campo: ${emptyFields.join(', ')} es requerido`
          : `Los campos: ${emptyFields.join(', ')} son requeridos`;
      throw new Error(message);
    }

    await this._schemaValidation(aux_case_payload);
  }

  _userCanEditCase() {
    if (this.case_data && this.user_data) {
      const case_designated_user_id = this.case_data?.responsable_id;
      const user_id = this.user_data?.user?.id;
      const has_permission = this.user_data?.permisions?.administrador.filter(
        (item) => item.name === 'CaseUpdateNotOwner'
      );
      return (
        case_designated_user_id === user_id ||
        (has_permission.length > 0 && has_permission[0].granted) ||
        false
      );
    } else {
      return true;
    }
  }

  async _uploadFile({
    contentType,
    fileName,
    file,
    url = 'case',
    fileTypeNumeric,
    fileTypeCategory,
  }) {
    const s3_payload = {
      id: this.case_id || this.generated_case_id,
      contentType,
      fileName,
      url,
    };

    const response = await apiService.post(
      `${this.url_api}/upload-s3-files`,
      s3_payload
    );

    if (response.status === 200 && response.data) {
      const uploadUrl = response.data.data?.uploadUrl;

      if (!uploadUrl) {
        throw new Error('No se recibió la URL pre-firmada de S3');
      }

      if (file) {
        await axios.put(uploadUrl, file, {
          headers: {
            'Content-Type': contentType,
          },
        });
        await this._scanFileForVirus(
          url,
          this.case_id || this.generated_case_id,
          fileName
        );
      }

      const payload = {
        case_id: this.case_id || this.generated_case_id,
        path: fileName,
        type: fileTypeNumeric ?? 1,
        description: contentType,
        size: file ? file.size : 0,
        is_active: 'true',
        id: uuidv4(),
        attachment_type: fileTypeCategory ?? null,
      };
      await apiService.post(`${this.url_api}/case-attachments`, payload);
    }
  }

  async _downloadFile(payload) {
    const response = await apiService.post(
      `${this.url_api}/download-s3-files`,
      payload
    );
    const uploadUrl = response?.data?.data?.uploadUrl;
    window.open(uploadUrl, '_blank', 'noopener,noreferrer');
  }

  async _schemaValidation(payload, data_structure) {
    if (data_structure) {
      const schemaBuilderResult = await SchemaBuilder.build(data_structure);
      const { error, ...validationResult } =
        schemaBuilderResult.validate(payload);
      if (error) {
        throw new Error(
          `Algunos campos del formulario auxiliar presentan errores de validación: ${error?.details[0].message}`
        );
      }
    }
  }

  async _fetchAuxLiteralList(entity, filter = []) {
    try {
      if (!entity) return [];
      const response = await apiService.post(
        `${this.url_api}/auxiliaries/${entity}/search`,
        {
          filter,
          limit: 0,
          offset: 0,
        }
      );
      if (response.status === 200 && response.data) {
        return response.data.data.items;
      }
      return [];
    } catch (error) {
      throw new Error(
        `Error fetching auxiliary literal list: ${error.message}`
      );
    }
  }

  async _scanFileForVirus(url, id, fileName) {
    try {
      const response = await apiService.post(
        `${this.url_api}/upload-s3-files/scan-s3-file`,
        { url, id, fileName }
      );

      if (response.data?.errors) {
        throw new Error('Virus scan failed');
      }
    } catch (error) {
      throw new Error(`Error scanning file for viruses: ${error.message}`);
    }
  }

  async _fetchUserByLogin(actualizador) {
    try {
      const response = await apiService.post(`${this.url_api}/users/search`, {
        filter: [
          {
            field: 'login',
            operator: 'eq',
            value: actualizador,
            type: 'AND',
          },
        ],
        limit: 1,
        offset: 0,
      });
      if (response.status === 200 && response.data) {
        return response.data.data.items;
      }
    } catch (error) {
      throw new Error(
        `Error al obtener los datos del usuario: ${error.message}`
      );
    }
  }
}

const kace_data = new KaceData();
export default kace_data;

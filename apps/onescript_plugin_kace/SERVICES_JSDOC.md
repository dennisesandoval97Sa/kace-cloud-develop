# Service JSDoc Signatures (Extracted)

Grouped by service (exported class), extracted from `src/plugins/kace/services/*.js`.

## ApiService (`apiService.js`)

### constructor


```js
    /**
     * @param {Object} params
     * @param {string} params.apiUrl
     * @param {string} params.fingerprint
     * @param {string} params.tenantId
     * @param {AuthService} params.authService
    * @param {number} [params.maxRetries=1]
    * @param {number} [params.retryDelayMs=400]
     */
```

### get


```js
    /**
     * @param {string} url
     * @param {import('axios').AxiosRequestConfig} [config]
     * @returns {Promise<import('axios').AxiosResponse<any>>}
     */
```

### post


```js
    /**
     * @param {string} url
     * @param {any} data
     * @param {import('axios').AxiosRequestConfig} [config]
     * @returns {Promise<import('axios').AxiosResponse<any>>}
     */
```

### put


```js
    /**
     * @param {string} url
     * @param {any} data
     * @param {import('axios').AxiosRequestConfig} [config]
     * @returns {Promise<import('axios').AxiosResponse<any>>}
     */
```

### delete


```js
    /**
     * @param {string} url
     * @param {import('axios').AxiosRequestConfig} [config]
     * @returns {Promise<import('axios').AxiosResponse<any>>}
     */
```

## AuthService (`authService.js`)

### constructor


```js
    /**
     * @param {Object} params
     * @param {string} params.apiUrl
     * @param {string} params.clientId
     * @param {string} params.tenantId
     * @param {string} params.fingerprint
     * @param {string} params.cognitoClientId
     * @param {string} params.cognitoUrl
     * @param {string|null} params.refreshToken
     * @param {import('./storeService').StoreService|null} [params.storeService=null]
     */
```

### refreshTokenFlow


```js
    /**
     * Refresh tokens using the refresh token (Cognito flow)
     * Updates instance tokens on success
        * @returns {Promise<{idToken: string, accessToken: string, tokenType: string, expiresIn: number}>}
     */
```

### validateToken


```js
    /**
     * Validate the current idToken, refresh if expired or about to expire
        * @returns {Promise<void>}
     */
```

### setTokens


```js
    /**
     * Set tokens directly (for initial login or restore)
     * @param {Object} params
     * @param {string} params.accessToken
     * @param {string|null} params.refreshToken
     * @param {string} params.idToken
     * @param {string} params.tokenType
     * @param {number} params.expiresIn
     * @returns {void}
     */
```

## AuxService (`auxService.js`)

### constructor


```js
    /**
     * @param {Object} params
     * @param {import('./apiService').ApiService} params.apiService
     * @param {any} params.store
     */
```

### fetchValidationSchema


```js
    /**
     * Fetch and extract the validation schema, handling nested data_structure logic.
     * @param {Object} params
     * @param {boolean} params.isCaseModule - Whether this is a case module
     * @param {string} params.schemaId - The schema id to fetch
     * @param {Object} params.auxCasesSchema - The aux cases schema object (optional)
     * @returns {Promise<Object>} The validation schema object
     */
```

### fetchAuxiliaryData


```js
    /**
     * Fetch auxiliary data for a given entity and field, with optional filter.
     * @param {Object} params
     * @param {string} params.entity - The auxiliary entity name
     * @param {string} params.field - The field to fetch
     * @param {Object|null} params.filter - Optional filter object { path, value }
     * @returns {Promise<Array>} Array of data
     */
```

### fetchAuxMotivos


```js
    /**
     * Fetch motivos (reasons) using fetchAuxiliaryData with fixed entity and field.
     * @param {string} endpoint - Optional endpoint/entity name, defaults to 'motivos_pausa'
     * @returns {Promise<Array>} Array of motivos
     */
```

### fetchAuxLiteralList


```js
    /**
     * Fetches a list of literals for a given auxiliary entity.
     * @param {Object} params
     * @param {string} params.entity
     * @param {Array} [params.filter=[]]
     * @returns {Promise<Array>}
     */
```

### fetchAuxSchema


```js
    /**
     * Fetches an auxiliary schema rules definition.
     * @param {Object} params
     * @param {string} params.schemaId
     * @returns {Promise<Object>}
     */
```

### fetchAuxCasesSchema


```js
    /**
     * Resolves the "cases" auxiliary schema definition and returns its schema rules.
     * @returns {Promise<Object>}
     */
```

### validateSchema


```js
    /**
     * Validate a payload against a provided data_structure using SchemaBuilder.
     * @param {Object} params
     * @param {Object} params.data_structure - The schema data structure to validate against (required)
     * @param {Object} params.payload - The payload to validate
     * @throws {Error} If data_structure is missing or validation fails
     */
```

## BaseService (`baseService.js`)

### constructor


```js
    /**
     * @param {Object} params
     * @param {any} params.store
     */
```

### get


```js
    /**
     * Magic dynamic getter: get('propName', args)
     * Attempts to read from store, otherwise calls fetchPropName(args) if available.
     * @param {string} prop
     * @param {Object} [args={}]
     * @returns {Promise<any>}
     */
```

## CaseService (`caseService.js`)

### constructor


```js
    /**
     * @param {Object} params
     * @param {import('./apiService').ApiService} params.apiService
     * @param {any} params.store
     * @param {(eventName: string, payload: any) => void} [params.emitEvent]
     * @param {import('./fileService').FileService} [params.fileService]
     * @param {import('./auxService').AuxService} [params.auxService]
     */
```

### getTransitionsData


```js
    /**
     * Fetch transitions data for the current case from the API.
        * @param {Object} params
        * @param {string|number} params.caseId
     * @returns {Promise<Object|null>} The transitions data or null
     */
```

### validateCaseFields


```js
    /**
     * Validate required case fields and auxiliary data before submission.
     * @param {Object} case_data - The case data object
     * @param {string} description - The case description
     * @throws {Error} If any required field is missing or invalid
     */
```

### fetchAuxCase


```js
    /**
     * Fetch aux-case data for a given case.
     * @param {Object} params
     * @param {string|number|null} [params.caseId=null]
     * @returns {Promise<{aux_case_data: any, aux_case_id: any} | null>}
     */
```

### submitCaseData


```js
    /**
     * Submits case + auxiliary data and uploads pending attachments.
     * @param {Object} params
     * @param {Object} params.caseData
     * @param {string} params.description
     * @param {string|number|null} [params.id=null]
     * @returns {Promise<void>}
     */
```

### createCase


```js
    /**
     * Creates a case and persists its id in store.
     * @param {Object} params
     * @param {Object} params.caseData
     * @param {string} params.description
     * @returns {Promise<void>}
     */
```

### createTimer


```js
    /**
     * Creates a case session duration timer in backend.
     * @returns {Promise<any>}
     */
```

### getCaseSessionId


```js
    /**
     * Searches for case-session-duration records for current user + case.
     * @returns {Promise<any|null>}
     */
```

### getOpenCaseSession


```js
    /**
     * Returns the most recent open (unfinished) case-session-duration record.
     * @returns {Promise<any|null>}
     */
```

### updateTimer


```js
    /**
     * Updates a timer session with the next event type and optional justification.
     * @param {string} timerId
     * @param {string} eventType
     * @param {string|null} [justification=null]
     * @returns {Promise<any>}
     */
```

### fetchCaseData


```js
    /**
     * Fetches case data from API and returns the data payload.
     * Used by BaseService.get('cases.case_data') via fetcher naming.
     * @param {Object} [args={}]
     * @param {string|number} [args.caseId]
     * @returns {Promise<any>}
     */
```

### fetchCaseDescription


```js
    /**
     * Fetches the case description string (HTML) from API.
     * @returns {Promise<string>}
     */
```

### handleErrorMessage


```js
    /**
     * Normalizes error messages from API responses.
     * @param {any} error
     * @returns {string}
     */
```

## ClassificationsService (`classificationsService.js`)

### constructor


```js
    /**
     * @param {Object} params
     * @param {import('./apiService').ApiService} params.apiService
     * @param {any} params.store
     * @param {import('./userService').UserService} params.userService
     * @param {(eventName: string, payload: any) => void} [params.emitEvent]
     */
```

### fetchCaseClassification


```js
    /**
     * Fetches the case classification items for a given case.
     * @param {Object} params
     * @param {string|number} params.caseId
     * @returns {Promise<any[]>}
     */
```

### fetchClassificationsGroupsRelationship


```js
    /**
     * Fetches the group-relationship records for a classification + group.
     * @param {Object} params
     * @param {string|number} params.classificationId
     * @param {string|number} params.groupId
     * @returns {Promise<any[]>}
     */
```

### fetchCaseClassificationRelationships


```js
    /**
     * Fetches both case classifications and (optionally) group relationships.
     * @param {Object} params
     * @param {string|number} params.caseId
     * @param {string|number|null} [params.parentId=null]
     * @returns {Promise<{caseClassifications: any[], groupClassifications: any[]}>}
     */
```

### fetchGroupClassification


```js
    /**
     * Fetches classifications available to the user's active group.
     * When parentId exists, it uses the parent case classification.
     * @param {Object} [args={}]
     * @param {string|number} [args.parentId]
     * @returns {Promise<any>}
     */
```

## ConfigurationService (`configurationService.js`)

### constructor


```js
    /**
     * @param {Object} params
     * @param {import('./apiService').ApiService} params.apiService
     * @param {any} params.store
     * @param {(eventName: string, payload: any) => void} [params.emitEvent]
     */
```

### fetchGlobalConfiguration


```js
    /**
     * Fetches global configuration settings for the selected group.
     * @param {Object} [args={}]
     * @returns {Promise<any>}
     */
```

## CustomListsService (`customListsService.js`)

### constructor


```js
    /**
     * @param {Object} params
     * @param {import('./apiService').ApiService} params.apiService
     * @param {any} params.store
     */
```

### fetchCustomListsById


```js
    /**
     * Fetch a custom list by its ID.
     * @param {string|number} id - The custom list ID
     * @param {string} url_api - The base API URL
     * @returns {Promise<Object|null>} The custom list data or null
     */
```

## FileService (`fileService.js`)

### constructor


```js
    /**
     * @param {Object} params
     * @param {import('./apiService').ApiService} params.apiService
     * @param {any} params.store
     * @param {(eventName: string, payload: any) => void} [params.emitEvent]
     */
```

### fetchGlobalConfiguration


```js
    /**
     * Fetches global configuration settings for the selected group.
     * @param {Object} [args={}]
     * @returns {Promise<any>}
     */
```

### uploadFile


```js
    /**
     * Uploads a file (S3 flow) and creates a case attachment record.
     * @param {Object} params
     * @param {string|number} params.id
     * @param {string} params.contentType
     * @param {string} params.fileName
     * @param {string} [params.url='case']
     * @returns {Promise<void>}
     */
```

### downloadFile


```js
    /**
     * Requests a download URL and opens it in a new window.
     * @param {any} payload
     * @returns {Promise<void>}
     */
```

## GlobalService (`globalService.js`)

### constructor


```js
    /**
     * @param {Object} params
     * @param {import('./apiService').ApiService} params.apiService
     * @param {any} params.store
     */
```

### fetchEndpointData


```js
    /**
     * Fetch data from an endpoint, normalizing the path and handling errors.
     * @param {string} endpoint
     * @param {string} url_api
     * @returns {Promise<Object|null>}
     */
```

## LiteralsService (`literalsService.js`)

### constructor


```js
    /**
     * @param {Object} params
     * @param {import('./apiService').ApiService} params.apiService
     * @param {any} params.store
     */
```

### fetchAuxReference


```js
    /**
     * Fetches literals by entity/type reference.
     * @param {Object} params
     * @param {string|number|null} params.entityId
     * @returns {Promise<any|null>}
     */
```

### fetchOptions


```js
    /**
     * Fetch options using an auxiliary reference by parentId.
     * @param {string|null} parentId
     * @returns {Promise<Array>} Array of option items
     */
```

## OneScriptService (`oneScriptService.js`)

### constructor


```js
    /**
     * @param {Object} params
     * @param {import('./apiService').ApiService} params.apiService
     * @param {any} params.store
     * @param {import('./classificationsService').ClassificationsService} [params.classificationsService]
     */
```

### getSchema


```js
    /**
   * Orchestrates fetching the schema, group relationships, and form schema.
   * @param {Object} params
   * @param {string|null} params.classificationId
   * @param {boolean} params.isCaseModule
   * @param {string|null} params.oneScriptFormId
   * @param {string|null} params.oneScriptSchemaApi
   * @param {string|null} params.groupId
   * @returns {Promise<{ oneScriptData: any, formSchema: any }>}
   */
```

### fetchFormSchema


```js
    /**
     * Fetch the form schema from an external schema API URL (not our API).
     * @param {string} schemaApiUrl - The full URL to fetch the schema from
     * @returns {Promise<Object|null>} The components schema or null
     */
```

### fetchOneScriptData


```js
    /**
     * Fetches OneScript metadata/config for a given OneScript form id.
     * @param {string|number|null} oneScriptFormId
     * @returns {Promise<{schema_id: any, url_api: any, name: any} | null>}
     */
```

## SchemaService (`schemaService.js`)

### constructor


```js
    /**
     * @param {Object} params
     * @param {import('./apiService').ApiService} params.apiService
     * @param {any} params.store
     */
```

### fetchSchema


```js
    /**
     * Fetches a schema by id.
     * Used by BaseService.get('schemas.<key>') via fetcher naming when applicable.
     * @param {Object} [args={}]
     * @param {string|number} args.schemaId
     * @returns {Promise<any>}
     */
```

## StatesService (`statesService.js`)

### constructor


```js
    /**
     * @param {Object} params
     * @param {import('./apiService').ApiService} params.apiService
     * @param {any} params.store
     * @param {(eventName: string, payload: any) => void} [params.emitEvent]
     */
```

### fetchCurrentTransition


```js
    /**
     * Fetches current transition details by transition id.
     * @param {Object} params
     * @param {string|number|null} [params.transition_id=null]
     * @returns {Promise<any>}
     */
```

### fetchTransitionsData


```js
    /**
     * Fetches available transitions for a given flow.
     * @param {Object} params
     * @param {string|number|null} [params.flow_id=null]
     * @returns {Promise<any[]>}
     */
```

### fetchStateName


```js
    /**
     * Fetches state name by state id.
     * @param {Object} params
     * @param {string|number} params.state_id
     * @returns {Promise<string|null>}
     */
```

### getStatesData


```js
    /**
     * Convenience method to fetch current transition + transitions list and toggle loading events.
     * @param {Object} params
     * @param {string|number|null} [params.transition_id=null]
     * @param {string|number|null} [params.flow_id=null]
     * @returns {Promise<{currentTransition: any, transitionsData: any}>}
     */
```

## StoreService (`storeService.js`)

### constructor


```js
    /**
     * @param {Object} [store=kaceStore]
     */
```

### initializeStore


```js
    /**
     * Loads persisted store data from localStorage (if present) into the in-memory store.
     * @returns {void}
     */
```

### get


```js
    /**
     * Gets a value by dot-path from the store.
     * @param {string} path
     * @returns {any}
     */
```

### set


```js
    /**
     * Sets a value by dot-path in the store and persists to localStorage.
     * @param {string} path
     * @param {any} value
     * @returns {void}
     */
```

### clear


```js
    /**
     * Clears the in-memory store and removes persisted data.
     * @returns {void}
     */
```

## TimerStorageService (`timerStorageService.js`)

### _getStorageKey


```js
  /**
   * Genera la key única para el timer basada en caseId.
   * @param {string|number} caseId
   * @returns {string}
   */
```

### saveTimerState


```js
  /**
    * Guarda el estado del timer en localStorage.
    * @param {string|number} caseId
    * @param {{timerId: string, events?: Array<{type: string, at: number}>}} timerData
    * @returns {boolean}
   */
```

### recoverTimerState


```js
  /**
  * Recupera el estado del timer desde localStorage
  * Retorna null si no existe o si está fuera de la ventana de recuperación
  * @param {string|number} caseId
  * @returns {{timerId: string, events: Array<{type: string, at: number}>, minutesSinceLastSave: number} | null}
   */
```

### _validateTimerData


```js
  /**
    * Valida que los datos del timer sean correctos.
    * @param {any} data
    * @returns {boolean}
   */
```

### clearTimerState


```js
  /**
  * Limpia el estado del timer del localStorage.
  * @param {string|number} caseId
  * @returns {void}
   */
```

### hasTimerState


```js
  /**
    * Verifica si existe un timer guardado para el caso.
    * @param {string|number} caseId
    * @returns {boolean}
   */
```

### clearAllTimers


```js
  /**
    * Limpia todos los timers del sessionStorage (útil para debugging).
    * @returns {void}
   */
```

## UserService (`userService.js`)

### constructor


```js
    /**
     * @param {Object} params
     * @param {import('./apiService').ApiService} params.apiService
     * @param {any} params.store
     */
```

### fetchUserData


```js
    /**
     * Fetches and stores authenticated user data.
     * Used by BaseService.get('user.user_data') via fetcher naming.
     * @param {Object} [args={}]
     * @param {string} [args.access_token]
     * @param {number} [args.expires_in]
     * @param {string} [args.id_token]
     * @param {string} [args.refresh_token]
     * @param {string} [args.token_type]
     * @returns {Promise<any>}
     */
```

### fetchConfigurationIdSelectedGroup


```js
    /**
     * Computes and stores the configuration id for the currently selected group.
     * @param {Object} [args={}]
     * @returns {Promise<any>}
     */
```

### fetchSelectedGroupId


```js
    /**
     * Computes and stores the selected group id.
     * @param {Object} [args={}]
     * @returns {Promise<any>}
     */
```

### fetchUserCanEditCase


```js
    /**
     * Checks whether the current user can edit the provided case.
     * @param {Object} params
     * @param {Object} params.caseData
     * @param {Object} params.userData
     * @returns {Promise<boolean>}
     */
```


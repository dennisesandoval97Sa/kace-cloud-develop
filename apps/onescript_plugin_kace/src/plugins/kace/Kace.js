class Kace {
  constructor({ store, storeService } = {}) {
    this._services = {};
    this._serviceClasses = {};
    this._serviceDeps = {};
    this._authService = null;
    this._apiService = null;
    this._session = {};
    this._store = store || null;
    this._storeService = storeService || null;
    if (this._store) {
      this._services['store'] = this._store;
    }
    if (this._storeService) {
      this._services['storeService'] = this._storeService;
    }
  }

  /**
   * Register a service class with optional dependencies.
   * If dependencies are omitted, Kace will try to resolve them by name from its registry.
   * @param {string} name
   * @param {Function} ServiceClass
   * @param {Object} [dependencies] - Optional dependencies to inject
   */
  registerService(name, ServiceClass, dependencies = null) {
    this._serviceClasses[name] = ServiceClass;
    this._serviceDeps[name] = dependencies;
    try {
      const inst = this._instantiateService(name);
      try {
        const proto = Object.getPrototypeOf(inst);
        if (proto && proto !== Object.prototype) {
          for (const key of Object.getOwnPropertyNames(proto)) {
            if (key === 'constructor') continue;
            const desc = Object.getOwnPropertyDescriptor(proto, key);
            if (desc && typeof desc.value === 'function') {
              try {
                inst[key] = inst[key].bind(inst);
              } catch (e) {
                // ignore bind failures for non-configurable properties
              }
            }
          }
        }
      } catch (e) {
        //ignore
      }

      this._services[name] = inst;
    } catch (err) {
      this._services[name] = null;
    }
  }

  _instantiateService(name) {
    const ServiceClass = this._serviceClasses[name];
    if (!ServiceClass)
      throw new Error(`Clase de servicio para '$ {name}' no registrada.`);

    let passedDeps = this._serviceDeps[name];
    let deps = {};

    if (
      passedDeps &&
      typeof passedDeps === 'object' &&
      Object.keys(passedDeps).length > 0
    ) {
      deps = passedDeps;
    } else {
      const paramMatch = ServiceClass.toString().match(
        /constructor\s*\(([^)]*)\)/
      );

      if (paramMatch) {
        const paramStr = paramMatch[1];

        if (paramStr.trim().startsWith('{')) {
          const keys = paramStr
            .replace(/[{}\s]/g, '')
            .split(',')
            .filter(Boolean);
          for (const key of keys) {
            if (this._services[key]) {
              deps[key] = this._services[key];
            }
          }
        }
      }
    }

    if (typeof deps === 'function') {
      return new ServiceClass(deps());
    }

    return new ServiceClass(deps);
  }

  _resolveDependencies(ServiceClass) {
    const paramMatch = ServiceClass.toString().match(
      /constructor\s*\(([^)]*)\)/
    );
    if (!paramMatch) return {};
    const paramStr = paramMatch[1];
    if (paramStr.trim().startsWith('{')) {
      const keys = paramStr
        .replace(/[{}\s]/g, '')
        .split(',')
        .filter(Boolean);
      const deps = {};
      for (const key of keys) {
        if (this._services[key]) deps[key] = this._services[key];
      }
      return deps;
    }

    return {};
  }

  /**
   * Register core services (auth, api, user) and make them available for dependency resolution.
   */
  registerCoreServices({ authService, apiService, userService }) {
    this._authService = authService;
    this._apiService = apiService;
    this._services['authService'] = authService;
    this._services['apiService'] = apiService;
    this._services['user'] = userService;
  }

  /**
   * Get a service instance by name.
   */
  getService(name) {
    return this._services[name];
  }

  /**
   * Register a raw value into the service registry (useful for functions/values like emitEvent).
   */
  registerValue(name, value) {
    this._services[name] = value;
  }

  /**
   * Magic getter for data from services.
   */
  get(target) {
    const [serviceName, ...path] = target.split('.');
    const service = this._services[serviceName];
    if (!service) throw new Error(`Service '${serviceName}' not registered.`);
    if (typeof service.get === 'function') {
      return service.get(path.join('.'), this._session);
    }
    throw new Error(`El servicio '${serviceName}' no admite 'get'.`);
  }

  async authenticate(credentials) {
    if (!this._authService) throw new Error('Auth service not registered.');
    const session = await this._authService.authenticate(credentials);
    this._session = session;
    return session;
  }

  setSession(session) {
    this._session = session;
  }

  getSession() {
    return this._session;
  }

  async callWithRetry(fn, retries = 1) {
    try {
      return await fn();
    } catch (err) {
      if (retries > 0 && this._authService) {
        await this._authService.refreshToken(this._session);
        return this.callWithRetry(fn, retries - 1);
      }
      throw err;
    }
  }

  /**
   * Loads session bootstrap data: global configuration (which chains `user → globalConfig`)
   * and, when editing an existing case, fetches case data in parallel with that chain.
   *
   * `fetchGlobalConfig` must run after `fetchUserData` (configuration id comes from user);
   * only the **case** fetch is parallelized with the configuration path when `caseId` is set.
   *
   * @param {{ caseId?: string | null }} [params={}]
   * @returns {Promise<void>}
   */
  async initSession(params = {}) {
    const { caseId = null } = params;
    const configuration = this.getService('configuration');
    const caseService = this.getService('cases');

    if (caseId) {
      await Promise.all([
        configuration?.get?.('config.global_config'),
        caseService?.get?.('cases.case_data'),
      ]);
      return;
    }

    await configuration?.get?.('config.global_config');
  }

  /**
   * Eager hydration after `initSession` + GET `/cases/:id`: attachments in store (for `useAttachment`),
   * aux row when not embedded in `cases.case_data`, and classification row (service skips HTTP when embedded).
   *
   * @param {{ caseId?: string | number | null }} [params={}]
   * @returns {Promise<{ auxCaseId: string | null, auxCaseData: Record<string, unknown> | null }>}
   */
  async hydrateExistingCase(params = {}) {
    const resolvedCaseId =
      params.caseId != null && params.caseId !== ''
        ? params.caseId
        : this._storeService?.get?.('cases.case_id');

    if (resolvedCaseId == null || resolvedCaseId === '') {
      return { auxCaseId: null, auxCaseData: null };
    }

    const fileService = this.getService('file');
    const caseService = this.getService('cases');
    const classificationsService = this.getService('classifications');
    const oneScriptService = this.getService('oneScript');
    const auxService = this.getService('aux');
    const userService = this.getService('user');
    const store = this._storeService;

    const caseRow = store?.get?.('cases.case_data');
    const hasEmbeddedAux =
      caseRow &&
      typeof caseRow === 'object' &&
      (caseRow.aux_cases != null || caseRow.aux_case != null);

    const clasificacionId =
      caseRow && typeof caseRow === 'object' && caseRow.clasificacion_id != null
        ? caseRow.clasificacion_id
        : null;

    const readAuxFromEmbedded = () => {
      if (!caseRow || typeof caseRow !== 'object') {
        return { auxCaseId: null, auxCaseData: null };
      }
      const ac = caseRow.aux_cases;
      const ax = caseRow.aux_case;
      if (ac && typeof ac === 'object') {
        const id = ac.id;
        const data = ac.data && typeof ac.data === 'object' ? ac.data : null;
        if (id != null || data) {
          return {
            auxCaseId: id != null ? String(id) : null,
            auxCaseData: data ? { ...data } : null,
          };
        }
      }
      if (ax && typeof ax === 'object') {
        const id = ax.id;
        const data = ax.data && typeof ax.data === 'object' ? ax.data : null;
        if (id != null || data) {
          return {
            auxCaseId: id != null ? String(id) : null,
            auxCaseData: data ? { ...data } : null,
          };
        }
      }
      return { auxCaseId: null, auxCaseData: null };
    };

    const prefetchAttachments = async () => {
      try {
        if (!fileService?.fetchAttachmentsByCaseId) return;
        const list = await fileService.fetchAttachmentsByCaseId(resolvedCaseId);
        if (store?.set && Array.isArray(list)) {
          store.set('cases.attachments', list);
          store.set('cases.attachments_prefetched', true);
        }
      } catch {
        // Adjuntos no bloquean el flujo de auth
      }
    };

    const prefetchAux = async () => {
      if (hasEmbeddedAux) {
        return readAuxFromEmbedded();
      }
      if (!caseService?.fetchAuxCase) {
        return { auxCaseId: null, auxCaseData: null };
      }
      try {
        const r = await caseService.fetchAuxCase({ caseId: resolvedCaseId });
        if (!r) return { auxCaseId: null, auxCaseData: null };
        const rawData = r.aux_case_data;
        return {
          auxCaseId: r.aux_case_id != null ? String(r.aux_case_id) : null,
          auxCaseData:
            rawData && typeof rawData === 'object' ? { ...rawData } : null,
        };
      } catch {
        return { auxCaseId: null, auxCaseData: null };
      }
    };

    const prefetchClassification = async () => {
      if (
        clasificacionId == null ||
        !classificationsService?.fetchCaseClassification
      ) {
        return;
      }
      try {
        // El parámetro se llama `caseId` pero el servicio filtra por id de clasificación.
        await classificationsService.fetchCaseClassification({
          caseId: clasificacionId,
        });
      } catch {
        // Opcional: la UI puede cargar clasificación más tarde
      }
    };

    /**
     * Eager prefetch de los esquemas que `<AuxCasesSchema>` necesita para renderizar:
     *   1) Resuelve el OneScript form id desde la relación clasificación↔grupo (o embedded).
     *   2) En paralelo: `GET /one_script/{id}`, `GET <url_api>` (componentes Form.io)
     *      y `POST /schemas/rules/search` (bundle aux_cases + reglas del form).
     *   3) Pre-llena `onescript.forms.${formId}` y `aux.forms.${schemaId}` para que
     *      `useSchema`/`<AuxCasesSchema>` no disparen requests al montar.
     * Cualquier fallo se silencia: `<AuxCasesSchema>` reintentará en su propio efecto.
     */
    const prefetchAuxSchemas = async () => {
      if (
        !oneScriptService ||
        !auxService ||
        !classificationsService ||
        !store?.set
      )
        return;
      if (clasificacionId == null) return;
      try {
        let groupId = store.get?.('config.selected_group_id');
        if (groupId == null) {
          try {
            const userData = await userService?.get?.('user.user_data');
            groupId = userData?.grupo_activo?.grupo_id ?? null;
          } catch {
            groupId = null;
          }
        }
        if (groupId == null) return;

        let rels = [];
        try {
          rels = await classificationsService.get(
            'classifications.classifications_groups_relationship',
            {
              classificationId: clasificacionId,
              groupId,
            }
          );
        } catch {
          return;
        }
        if (!Array.isArray(rels) || !rels.length) return;
        const formId =
          rels[0]?.one_script_id ||
          rels[0]?.form ||
          rels[0]?.form_id ||
          rels[0]?.one_script_form_id ||
          null;
        if (!formId) return;

        let oneScriptData = null;
        try {
          oneScriptData = await oneScriptService.fetchOneScriptData(formId);
        } catch {
          oneScriptData = null;
        }
        const schemaId = oneScriptData?.schema_id ?? null;
        if (!schemaId) return;

        const formSchemaPromise = oneScriptData?.url_api
          ? oneScriptService
              .fetchFormSchema(oneScriptData.url_api)
              .catch(() => null)
          : Promise.resolve(null);
        const bundlePromise = auxService
          .fetchSchemasRulesBundle({ schemaId })
          .catch(() => null);

        const [formSchema, bundle] = await Promise.all([
          formSchemaPromise,
          bundlePromise,
        ]);

        store.set(`onescript.forms.${formId}`, {
          oneScriptData,
          formSchema: formSchema ?? null,
        });
        if (bundle?.validationSchema) {
          store.set(`aux.forms.${schemaId}`, { ...bundle.validationSchema });
          store.set('aux_case.aux_cases_schema', {
            ...bundle.validationSchema,
          });
          store.set('aux_case.hasSchema', true);
        }
      } catch {
        // Falla silenciosa: el componente reintentará en su propio efecto.
      }
    };

    const [, auxResult] = await Promise.all([
      prefetchAttachments(),
      prefetchAux(),
      prefetchClassification(),
      prefetchAuxSchemas(),
    ]);

    return {
      auxCaseId: auxResult.auxCaseId,
      auxCaseData: auxResult.auxCaseData,
    };
  }
}

export default Kace;

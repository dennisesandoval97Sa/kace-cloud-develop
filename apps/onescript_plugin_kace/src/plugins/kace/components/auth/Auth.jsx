// apps/onescript_plugin_kace/src/plugins/kace/components/auth/Auth.jsx
import './Auth.css';
import { useEffect, useState } from 'react';
import kace_data from '#plugins/kace/shared/KaceData.js';
import {
  VITE_COGNITO_CLIENT_ID,
  VITE_COGNITO_URL,
  VITE_TENANT_ID,
} from '#plugins/kace/env/index.js';
import { v4 as uuidv4 } from 'uuid';
import {
  KaceEngine,
  notifyKaceAuthReady,
  resetKaceEngineCache,
} from '#plugins/kace/KaceEngine.js';
import { storeService } from '#plugins/kace/services/storeService.js';
import { useAuthInteractionReporter } from '#plugins/kace/hooks/useAuthInteractionReporter.hook.js';
import { buildInitialCaseData } from '#plugins/kace/components/auth/buildInitialCaseData.js';
import { useInitHandshake } from '#plugins/kace/hooks/useInitHandshake.hook.js';
import { useKaceTokenSync } from '#plugins/kace/hooks/useKaceTokenSync.hook.js';
import { setEmbeddedInKace } from '#plugins/kace/shared/kaceParentTokenBridge.js';
import {
  mergeKaceSessionTokensBundle,
  SessionStorageCache,
} from '#plugins/kace/services/sessionStorageCache.js';
import { getOnescriptCacheTtlMs } from '#plugins/kace/utils/getOnescriptCacheTtlMs.js';
import { getTokenUserId } from '#plugins/kace/utils/getTokenUserId.js';
import { applyCaseEditLock } from './applyCaseEditLock.js';
import { syncUserDataFromAuthCognito } from './syncUserDataFromAuthCognito.js';
import { scheduleCaseEditLockReapply } from './scheduleCaseEditLockReapply.js';
import { CaseEditBlockedBanner } from './CaseEditBlockedBanner.jsx';
import {
  clearEditSnapshot,
  freezeEditSnapshot,
  omitCurrentKeys,
} from '#plugins/kace/utils/editSnapshot.js';

/**
 * @typedef Props
 * @prop {{ [x: string]: unknown }} component - `this.component` properties
 * @prop {(eventName: string, payload: unknown) => void} emitEvent - Emits Form.io events.
 * @prop {(data: { case_data?: Record<string, unknown>, kace_config?: unknown }) => void} handleChange
 * @prop {any} [form]
 * @prop {boolean} [disabled]
 */

const getEnvOverrides = () => {
  if (!import.meta.env.DEV) return {};
  const env = import.meta.env || {};
  const pick = (key) => {
    const v = env[key];
    return v === undefined || v === null || v === '' ? undefined : v;
  };
  return Object.fromEntries(
    Object.entries({
      refresh_token: pick('VITE_KACE_TEST_REFRESH_TOKEN'),
      fingerprint: pick('VITE_KACE_TEST_FINGERPRINT'),
      tenant_id: pick('VITE_KACE_TEST_TENANT_ID'),
      client_id: pick('VITE_KACE_TEST_CLIENT_ID'),
      user_id: pick('VITE_KACE_TEST_USER_ID'),
      case_id: pick('VITE_KACE_TEST_CASE_ID'),
      parent_id: pick('VITE_KACE_TEST_PARENT_ID'),
      url_api: pick('VITE_KACE_TEST_API_URL'),
      cognito_client_id: pick('VITE_KACE_TEST_COGNITO_CLIENT_ID'),
      cognito_url: pick('VITE_KACE_TEST_COGNITO_URL'),
      one_script_form_id: pick('VITE_KACE_TEST_ONE_SCRIPT_FORM_ID'),
      grupo_activo: pick('VITE_KACE_TEST_GRUPO_ACTIVO'),
    }).filter(([, v]) => v !== undefined)
  );
};

/**
 * @param {Props} props
 */
export const Auth = ({
  component,
  emitEvent,
  handleChange,
  form,
  disabled: _disabled,
}) => {
  useAuthInteractionReporter();

  const {
    data: handshake,
    error: handshakeError,
    pending,
  } = useInitHandshake();

  const embeddedReady = Boolean(handshake && !handshakeError && !pending);
  useKaceTokenSync(embeddedReady);
  const [caseEditLocked, setCaseEditLocked] = useState(false);

  useEffect(() => {
    if (pending || handshakeError || !handshake) return;

    (async () => {
      try {
        setEmbeddedInKace(true);
        storeService.set('auth.embedded_in_kace', true);
        resetKaceEngineCache();
        const { params, tokens, authCognitoResponse } = handshake;
        const envOverrides = getEnvOverrides();

        const payload = {
          refresh_token: params.refresh_token,
          fingerprint: params.fingerprint,
          tenant_id: params.tenant_id || component.tenant_id || VITE_TENANT_ID,
          client_id: params.client_id,
          user_id: params.user_id,
          parent_id: params.parent_id,
          cognito_client_id:
            params.cognito_client_id ||
            component.cognito_client_id ||
            VITE_COGNITO_CLIENT_ID ||
            null,
          cognito_url:
            params.cognito_url ||
            component.cognito_url ||
            VITE_COGNITO_URL ||
            null,
          case_id: params.case_id,
          url_api: params.url_api || component.url_api || null,
          one_script_form_id:
            params.one_script_form_id || component.one_script_form_id || null,
        };

        if (params.primary_entity === 'cases') {
          payload.case_id = params.entity_id;
        }

        Object.assign(payload, envOverrides);

        if (payload.tenant_id) {
          storeService.set('auth.tenant_id', payload.tenant_id);
        }

        if (tokens?.id_token) {
          try {
            mergeKaceSessionTokensBundle({
              'auth.id_token': tokens.id_token,
              'auth.access_token': tokens.access_token,
              'auth.token_type': tokens.token_type,
              'auth.expires_in': String(tokens.expires_in ?? ''),
            });
          } catch (e) {
            console.warn(
              '[Auth] sessionStorage write failed for session tokens',
              e
            );
          }
        }

        SessionStorageCache.invalidate('auth-cognito', 'default');
        try {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('auth.auth_cognito_response');
          }
        } catch (_) {}

        if (authCognitoResponse) {
          try {
            const cacheTtlMs = getOnescriptCacheTtlMs(storeService);
            if (cacheTtlMs > 0) {
              const tokenUserId = getTokenUserId(tokens?.id_token);
              SessionStorageCache.set(
                'auth-cognito',
                'default',
                {
                  data: authCognitoResponse,
                  userId: authCognitoResponse?.user?.id ?? null,
                  tokenUserId,
                },
                cacheTtlMs
              );
            }
          } catch (e) {
            console.warn(
              '[Auth] sessionStorage write failed for auth-cognito cache',
              e
            );
          }
        }

        storeService.set('auth', {
          refresh_token: payload.refresh_token,
          fingerprint: payload.fingerprint,
          tenant_id: payload.tenant_id,
          client_id: payload.client_id,
          cognito_client_id: payload.cognito_client_id,
          cognito_url: payload.cognito_url,
        });
        storeService.set('auth.handshake_params', params ?? null);
        storeService.set(
          'auth.auth_cognito_response',
          authCognitoResponse ?? null
        );

        storeService.set('user.user_id', payload.user_id);
        storeService.set('cases.case_id', payload.case_id);
        storeService.set('config.api_url', payload.url_api);
        storeService.set(
          'oneScript.one_script_form_id',
          payload.one_script_form_id
        );
        storeService.set('cases.parent_id', payload.parent_id);

        const kaceEngine = KaceEngine();
        if (!payload.case_id) {
          payload.generated_case_id = uuidv4();
          storeService.set(
            'cases.generated_case_id',
            payload.generated_case_id
          );
        }
        await kaceEngine.initSession({ caseId: payload.case_id || null });
        const grupo_id = storeService.get('config.selected_group_id');

        const current_case_id = payload.case_id ?? payload.generated_case_id;
        const isEdit = Boolean(payload.case_id);
        const loadedCase = isEdit ? storeService.get('cases.case_data') : null;

        if (isEdit && loadedCase) {
          const caseService = kaceEngine.getService('cases');
          const flags =
            caseService?.readEmbeddedPayloadFlags?.(loadedCase) ?? null;
          if (flags?.states) emitEvent('kaceStatesLoading', false);
          if (flags?.attachments) emitEvent('kaceAttachmentsLoading', false);
          if (flags?.description) emitEvent('kaceDescriptionLoading', false);
        }

        let auxCaseIdFromFetch = null;
        let auxCaseDataFromFetch = null;
        if (isEdit && typeof kaceEngine.hydrateExistingCase === 'function') {
          const hydrated = await kaceEngine.hydrateExistingCase({
            caseId: payload.case_id,
          });
          auxCaseIdFromFetch = hydrated.auxCaseId;
          auxCaseDataFromFetch = hydrated.auxCaseData;
        }

        const initial_case_data = buildInitialCaseData({
          isEdit,
          currentCaseId: String(current_case_id),
          grupoId: grupo_id,
          payload,
          loadedCase,
          auxCaseIdFromFetch,
          auxCaseDataFromFetch,
        });

        syncUserDataFromAuthCognito(authCognitoResponse);

        if (isEdit) {
          const embeddedDesc =
            loadedCase?.descripcion_caso &&
            typeof loadedCase.descripcion_caso === 'object'
              ? loadedCase.descripcion_caso.descripcion
              : undefined;
          freezeEditSnapshot(storeService, {
            case: omitCurrentKeys(initial_case_data.case),
            auxData: initial_case_data.aux_cases?.data ?? {},
            auxId: initial_case_data.aux_cases?.id,
            description:
              typeof embeddedDesc === 'string' ? embeddedDesc : undefined,
          });
        }

        let shouldLockCaseEdit = false;
        if (isEdit) {
          if (!storeService.get('user.user_data')) {
            console.warn(
              '[Auth] user.user_data missing after sync; skipping case edit lock'
            );
          } else {
            const userService = kaceEngine.getService('user');
            const canEdit =
              typeof userService?.canEditCaseSync === 'function'
                ? userService.canEditCaseSync()
                : true;
            shouldLockCaseEdit = !canEdit;
          }
        }

        storeService.set('cases.case_edit_locked', shouldLockCaseEdit);
        setCaseEditLocked(shouldLockCaseEdit);

        if (shouldLockCaseEdit) {
          if (form) {
            applyCaseEditLock(form, { locked: true });
            scheduleCaseEditLockReapply(form);
          } else {
            console.warn(
              '[Auth] form root unavailable; lock deferred to attach'
            );
          }
        }

        const case_data = initial_case_data || {};
        const kace_config = {
          kace_data,
          apiService: kaceEngine.getService('apiService'),
          kace: kaceEngine,
        };
        handleChange({ case_data, kace_config });
        emitEvent('kaceAuthData', kace_data);
        notifyKaceAuthReady();
      } catch (error) {
        try {
          storeService.set('config.kace_auth_ready', false);
        } catch (_) {}
        try {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('kace.auth_ready');
          }
        } catch (_) {}
        try {
          if (typeof window !== 'undefined') {
            window['__KACE_AUTH_READY__'] = false;
          }
        } catch (_) {}
        emitEvent('kaceAuthError', error.message);
        emitEvent('kaceClassificationsLoading', false);
        emitEvent('kaceStatesLoading', false);
        emitEvent('kaceAttachmentsLoading', false);
        emitEvent('kaceDescriptionLoading', false);
      } finally {
        emitEvent('kaceClassificationsLoading', false);
        emitEvent('kaceStatesLoading', false);
        emitEvent('kaceAttachmentsLoading', false);
        emitEvent('kaceDescriptionLoading', false);
      }
    })();
  }, [pending, handshakeError, handshake]);

  useEffect(() => {
    return () => {
      localStorage.removeItem('kace_data');
      try {
        clearEditSnapshot(storeService);
      } catch (error) {
        console.warn('Failed to clear edit snapshot on unmount', error);
      }
    };
  }, []);

  if (handshakeError) {
    return (
      <div className="kace-init-error">
        No se pudo inicializar el formulario. El componente padre no respondió a
        tiempo.
      </div>
    );
  }

  if (pending || !handshake) {
    return null;
  }

  if (caseEditLocked) {
    return <CaseEditBlockedBanner />;
  }

  return null;
};

/**
 * Persists global configuration API payload and derived fields into storeService.
 * Paths align with STORE_TO_LEGACY_MAP in data/constants.js for KaceData sync.
 *
 * @param {{ set: (path: string, value: unknown) => void }} storeService
 * @param {Record<string, unknown> | null | undefined} settings
 * @returns {void}
 */
export function applyGlobalConfigToStore(storeService, settings) {
  try {
    if (!storeService || typeof storeService.set !== 'function') {
      return;
    }
    /** @type {Record<string, any> | null | undefined} */
    const gc = settings;

    storeService.set('config.global_config', gc ?? null);
    storeService.set(
      'config.cases_config',
      gc?.layouts?.application?.agente?.cases ?? null
    );
    storeService.set(
      'config.case_enable_subcases',
      gc?.behaviors?.application?.agente?.casos?.case_enable_subcases ?? false
    );
    storeService.set(
      'config.allow_description_empty',
      gc?.behaviors?.application?.agente?.casos?.allow_description_empty ??
        false
    );
    storeService.set(
      'cases.case_require_state_change',
      gc?.behaviors?.application?.agente?.casos?.case_require_state_change ??
        false
    );
    const allowedExt =
      gc?.behaviors?.application?.agente?.files_extensions
        ?.allowed_file_extensions;
    storeService.set('cases.allowed_files_extensions', allowedExt ?? []);
    storeService.set(
      'cases.quantity_files_allowed',
      gc?.behaviors?.application?.agente?.files_extensions
        ?.quantity_files_allowed ?? 0
    );
    storeService.set(
      'cases.maximun_size_allowed',
      gc?.behaviors?.application?.agente?.files_extensions
        ?.maximun_size_allowed ?? 0
    );
  } catch (error) {
    console.error('[applyGlobalConfigToStore]', error);
  }
}

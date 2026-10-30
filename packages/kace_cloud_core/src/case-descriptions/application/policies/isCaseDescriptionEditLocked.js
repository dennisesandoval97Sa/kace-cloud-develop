export function isCaseDescriptionEditLocked(globalConfig) {
    const behaviorConfig = globalConfig?.settings?.behaviors?.getConfig?.('agente', 'casos');
    return behaviorConfig?.lock_case_description_edit === true;
}

export function isCaseReclassificationEnabled(globalConfig) {
    const behaviorConfig = globalConfig?.settings?.behaviors?.getConfig?.('agente', 'casos');
    return behaviorConfig?.allow_case_reclassification === true;
}

export const createWsRestHandlerFactories = ({
    restFlowEventName,
    restFlowHandler,
    workspacePriorityReorderEventName,
    workspacePriorityReorderHandler,
}) =>
    new Map([
        [restFlowEventName, restFlowHandler],
        [workspacePriorityReorderEventName, workspacePriorityReorderHandler],
    ]);

import { useMemo } from "react";
import useActionsOptions from "@kace_v2/shared/hooks/useActionsOptions.hook";
import useRestFlowsOptions from "@kace_v2/shared/hooks/useRestFlowsOptions.hook";
import useOneScriptOptions from "@kace_v2/features/boards/hooks/useOneScriptOptions.hook";

const EMPTY_ROWS = [];

const idsForType = (rows, type) =>
    (rows || []).filter((row) => row?.type === type && row?.ref_id).map((row) => row.ref_id);

const useBoardsOptions = (rows = EMPTY_ROWS) => {
    const actionIds = useMemo(() => idsForType(rows, "ACTION"), [rows]);
    const restFlowIds = useMemo(() => idsForType(rows, "RESTFLOW"), [rows]);
    const oneScriptIds = useMemo(() => idsForType(rows, "ONESCRIPT"), [rows]);

    const actions = useActionsOptions(actionIds);
    const restFlows = useRestFlowsOptions(restFlowIds);
    const oneScripts = useOneScriptOptions(oneScriptIds);

    return {
        options: {
            ACTION: actions.options,
            RESTFLOW: restFlows.options,
            ONESCRIPT: oneScripts.options,
        },
        selectors: {
            ACTION: actions,
            RESTFLOW: restFlows,
            ONESCRIPT: oneScripts,
        },
    };
};

export default useBoardsOptions;

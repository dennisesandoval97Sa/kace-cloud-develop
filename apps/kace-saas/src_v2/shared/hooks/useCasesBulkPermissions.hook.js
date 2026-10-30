import { useMemo } from "react";
import useUserInformation from "@kace/hooks/useUserInformation";
import { MODULES } from "@kace_v2/shared/constants/modules.contants";

const CASES_MODULE_ID = "cases";

const hasPermission = (list = [], moduleId, name) =>
    list.some((p) => p.module_id === moduleId && p.name === name && p.granted);

const permissionsForScope = (scope, permissionsAdmin, permissionsAgent) =>
    scope === "admin" ? permissionsAdmin : permissionsAgent;

const useCasesBulkPermissions = (permissionScope) => {
    const { permissionsAdmin, permissionsAgent } = useUserInformation();

    return useMemo(
        () => ({
            canUpdateBoardRegister: hasPermission(
                permissionsForScope(permissionScope, permissionsAdmin, permissionsAgent),
                MODULES.BOARDS.ID,
                MODULES.BOARDS.PERMISSIONS.UPDATE_REGISTER,
            ),
            canBulkClose: hasPermission(permissionsAdmin, CASES_MODULE_ID, "CasesBulkClose"),
            canBulkTransition: hasPermission(permissionsAdmin, CASES_MODULE_ID, "CasesBulkTransition"),
            canBulkAssign: hasPermission(permissionsAdmin, CASES_MODULE_ID, "CasesBulkAssign"),
        }),
        [permissionScope, permissionsAdmin, permissionsAgent],
    );
};

export default useCasesBulkPermissions;

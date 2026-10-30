import { useCallback, useMemo } from "react";
import { useFormikContext } from "formik";
import { permissionsListProcessed } from "../utils/processRoleData";

const useRoleFormPermissionsHandler = () => {
    const { values, setFieldValue } = useFormikContext();

    const rolesData = useMemo(() => values?.permisos ?? {}, [values?.permisos]);

    const {
        aux: auxPermissions,
        admin: adminPermissions,
        agent: agentPermissions,
    } = useMemo(() => permissionsListProcessed(rolesData), [rolesData]);

    const allPermissions = useMemo(() => {
        return Object.values(rolesData).flat();
    }, [rolesData]);

    const areAllGlobalChecked = useMemo(() => {
        if (allPermissions.length === 0) return false;
        const checkedCount = allPermissions.filter((p) => p.granted).length;
        if (checkedCount > 0 && checkedCount < allPermissions.length) {
            return "indeterminate";
        }
        return allPermissions.every((p) => p.granted);
    }, [allPermissions]);

    const handleToggleAllGlobal = useCallback(() => {
        const newGlobalState = !areAllGlobalChecked;
        const newData = { ...rolesData };
        for (const roleName in newData) {
            newData[roleName] = newData[roleName].map((perm) => ({
                ...perm,
                granted: newGlobalState,
            }));
        }
        setFieldValue("permisos", newData);
    }, [areAllGlobalChecked, rolesData, setFieldValue]);

    const handleToggleAllInRole = useCallback(
        (module, permissionId, newCheckedState) => {
            const newData = {
                ...rolesData,
                [module]: rolesData[module].map((perm) => ({
                    ...perm,
                    granted: perm.module_id === permissionId ? newCheckedState : perm.granted,
                })),
            };
            setFieldValue("permisos", newData);
        },
        [rolesData, setFieldValue],
    );

    const handlePermissionChange = useCallback(
        (permissionName, newCheckedState) => {
            const newData = { ...rolesData };
            for (const roleName in newData) {
                newData[roleName] = newData[roleName].map((perm) =>
                    perm.name === permissionName ? { ...perm, granted: newCheckedState } : perm,
                );
            }
            setFieldValue("permisos", newData);
        },
        [rolesData, setFieldValue],
    );

    return {
        auxPermissions,
        agentPermissions,
        adminPermissions,
        areAllGlobalChecked,
        handleToggleAllGlobal,
        handlePermissionChange,
        handleToggleAllInRole,
    };
};

export default useRoleFormPermissionsHandler;

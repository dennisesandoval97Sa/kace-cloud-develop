import { useCallback, useEffect, useMemo, useState } from "react";
import { useFormikContext } from "formik";
import { formatModuleName, getPermissionLabel } from "../../../utils/processRoleData";
import { useTranslation } from "react-i18next";

const ROLE_LABELS = {
    agente: "agent",
    administrador: "admin",
    auxiliaries: "auxiliaries",
    search: "searchPermissions",
};

const useRoleFormTabSearch = () => {
    const { t } = useTranslation();
    const { values, setFieldValue } = useFormikContext();

    const initialRolesData = useMemo(() => values?.permisos ?? {}, [values?.permisos]);

    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [activeTab, setActiveTab] = useState("agente");
    const [globalSelectAll, setGlobalSelectAll] = useState(false);

    const getModulesFromPermissions = (permissions) => {
        const moduleMap = new Map();

        permissions.forEach((permission) => {
            if (!moduleMap.has(permission.module_id)) {
                moduleMap.set(permission.module_id, []);
            }
            moduleMap.get(permission.module_id).push(permission);
        });

        return Array.from(moduleMap.entries())
            .map(([moduleId, modulePermissions]) => ({
                id: moduleId,
                name: t(`modulesNames.${moduleId}`, formatModuleName(moduleId)),
                permissions: modulePermissions.map((permission) => ({
                    ...permission,
                    label: getPermissionLabel(permission, activeTab, t),
                })),
                selected: modulePermissions.filter((p) => p.granted).length,
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    };

    const getCurrentModules = () => {
        const currentPermissions = initialRolesData[activeTab] || [];
        return getModulesFromPermissions(currentPermissions);
    };

    const getFilteredModules = (modules) => {
        return modules.filter((module) => {
            const matchesSearch =
                module.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                module.permissions.some(
                    (p) =>
                        p.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        p.name.toLowerCase().includes(searchTerm.toLowerCase()),
                );

            const matchesFilter =
                filterStatus === "all" ||
                (filterStatus === "selected" && module.selected > 0) ||
                (filterStatus === "unselected" && module.selected === 0);

            return matchesSearch && matchesFilter;
        });
    };

    const handleGlobalSelectAll = useCallback(() => {
        const newGlobalState = !globalSelectAll;
        setGlobalSelectAll(newGlobalState);

        setFieldValue("permisos", {
            ...initialRolesData,
            [activeTab]: initialRolesData[activeTab].map((permission) => ({
                ...permission,
                granted: newGlobalState,
            })),
        });
    }, [activeTab, globalSelectAll, initialRolesData, setGlobalSelectAll, setFieldValue]);

    const handleModuleSelectAll = useCallback(
        (moduleId, selectAll) => {
            setFieldValue("permisos", {
                ...initialRolesData,
                [activeTab]: initialRolesData[activeTab].map((permission) =>
                    permission.module_id === moduleId ? { ...permission, granted: selectAll } : permission,
                ),
            });
        },
        [activeTab, initialRolesData, setFieldValue],
    );

    const handlePermissionToggle = useCallback(
        (moduleId, permissionName) => {
            setFieldValue("permisos", {
                ...initialRolesData,
                [activeTab]: initialRolesData[activeTab].map((permission) =>
                    permission.module_id === moduleId && permission.name === permissionName
                        ? { ...permission, granted: !permission.granted }
                        : permission,
                ),
            });
        },
        [activeTab, initialRolesData, setFieldValue],
    );

    const availableRoles = useMemo(
        () => Object.keys(initialRolesData).map((role) => ({ role, label: ROLE_LABELS[role] ?? role })),
        [initialRolesData],
    );

    const currentModules = useMemo(() => getCurrentModules(), [getCurrentModules]);

    useEffect(() => {
        const currentPermissions = initialRolesData[activeTab] || [];
        const allGranted = currentPermissions.length > 0 && currentPermissions.every((p) => p.granted);
        setGlobalSelectAll(allGranted);
    }, [initialRolesData, activeTab]);

    return {
        initialRolesData,
        searchTerm,
        filterStatus,
        globalSelectAll,
        activeTab,
        availableRoles,
        currentModules,
        setSearchTerm,
        setFilterStatus,
        setActiveTab,
        getFilteredModules,
        handleGlobalSelectAll,
        handleModuleSelectAll,
        handlePermissionToggle,
    };
};

export default useRoleFormTabSearch;

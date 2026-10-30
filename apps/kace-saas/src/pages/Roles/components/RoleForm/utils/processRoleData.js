export const groupAndSortPermissionsByModule = (permissionsList) => {
    if (!permissionsList || !Array.isArray(permissionsList)) {
        return {};
    }

    const grouped = permissionsList.reduce((accumulator, currentPermission) => {
        const { module_id } = currentPermission;

        if (!accumulator[module_id]) {
            accumulator[module_id] = [];
        }

        accumulator[module_id].push(currentPermission);

        return accumulator;
    }, {});

    const sortedKeys = Object.keys(grouped).sort();

    const sortedGroupedPermissions = sortedKeys.reduce((sortedAccumulator, key) => {
        sortedAccumulator[key] = grouped[key];
        return sortedAccumulator;
    }, {});

    return sortedGroupedPermissions;
};

export const permissionsListProcessed = (permissions) => {
    try {
        if (!permissions || typeof permissions !== "object") {
            return { agent: {}, admin: {}, aux: {} };
        }

        const agentPermissions = groupAndSortPermissionsByModule(permissions?.agente || []);
        const adminPermissions = groupAndSortPermissionsByModule(permissions?.administrador || []);
        const auxPermissions = groupAndSortPermissionsByModule(permissions?.auxiliaries || []);

        return {
            agent: agentPermissions,
            admin: adminPermissions,
            aux: auxPermissions,
        };
    } catch {
        // NO-SONAR: se devuelve un objeto vacío para cada grupo de permisos para evitar errores en el flujo.
        return { agent: {}, admin: {}, aux: {} };
    }
};

export const validatePesmisions = (permissions) => {
    try {
        const hasGrantedPermission = (permissionList = []) =>
            Array.isArray(permissionList) && permissionList.some((item) => item.granted);

        const validateAdmin = hasGrantedPermission(permissions?.administrador);
        const validateAgente = hasGrantedPermission(permissions?.agente);
        const validateAuxiliries = hasGrantedPermission(permissions?.auxiliaries);
        const validateSearch = hasGrantedPermission(permissions?.search);

        return validateAdmin || validateAgente || validateAuxiliries || validateSearch;
    } catch {
        // NO-SONAR: Si ocurre un error al validar permisos, se retorna false para evitar que la función falle inesperadamente
        return false;
    }
};

const toPascalCase = (text) => {
    return text
        .split(/[-_]/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join("");
};

export const formatModuleName = (moduleName) => {
    if (!moduleName || typeof moduleName !== "string") return "";

    return moduleName
        .replace(/[-_]/g, " ")
        .split(" ")
        .map((word, index) =>
            index === 0 ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word.toLowerCase(),
        )
        .join(" ");
};

const AUXILIARY_ACTIONS = ["Create", "Update", "Delete", "Read"];

// Contrato del backend (SearchPermissionsCatalog): la descripción no se localiza allá.
const SEARCH_ADVANCED_PREFIX = "Use advanced search filters on ";

const toReadableName = (moduleId) => moduleId.replace(/[-_]/g, " ");

export const getPermissionLabel = ({ name, description, module_id }, role, t) => {
    if (role === "search" && description.startsWith(SEARCH_ADVANCED_PREFIX)) {
        return t("rol.form.permissionLabels.searchAdvanced", {
            endpoint: description.slice(SEARCH_ADVANCED_PREFIX.length),
        });
    }

    const auxiliaryAction =
        role === "auxiliaries" && AUXILIARY_ACTIONS.find((action) => name === `${toPascalCase(module_id)}${action}`);
    if (auxiliaryAction) {
        return t(`rol.form.permissionLabels.auxiliary${auxiliaryAction}`, { module: toReadableName(module_id) });
    }

    return description;
};

export const generateAuxiliariesPermissions = (auxiliariesData = []) => {
    try {
        if (auxiliariesData.length === 0) return [];

        return auxiliariesData.flatMap(({ name: module_id }) => {
            const pascalName = toPascalCase(module_id);
            const readableName = toReadableName(module_id);

            return AUXILIARY_ACTIONS.map((action) => ({
                module_id,
                name: `${pascalName}${action}`,
                description: `${action} ${readableName}`,
                granted: false,
            }));
        });
    } catch {
        // NO-SONAR: Si ocurre un error durante la generación de permisos para los auxiliares, se devuelve un arreglo vacío
        return [];
    }
};

export const mergeGrantedStatus = (targetData, sourceData = {}) => {
    try {
        if (!targetData || typeof targetData !== "object") {
            return {};
        }

        const updated = {};

        for (const role in targetData) {
            const targetPermissions = targetData[role];
            const sourcePermissions = sourceData[role] || [];

            const grantedMap = Object.fromEntries(sourcePermissions.map((perm) => [perm.name, perm.granted]));

            updated[role] = targetPermissions.map((perm) => ({
                ...perm,
                granted: grantedMap[perm.name] ?? perm.granted,
            }));
        }

        return updated;
    } catch {
        // NO-SONAR: Si ocurre un error al fusionar los estados de permisos, se devuelve un objeto vacío para evitar fallos en el flujo.
        return {};
    }
};

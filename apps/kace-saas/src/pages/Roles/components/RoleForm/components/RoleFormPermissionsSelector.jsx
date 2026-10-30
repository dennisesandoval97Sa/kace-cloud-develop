import { useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import { Card, CardContent, CardHeader, CardTitle, Checkbox, Label } from "@/components/ui-shared";
import RoleFormPermissionsCheckbox from "./RoleFormPermissionsCheckbox";
import { useTranslation } from "react-i18next";
import { formatModuleName } from "../utils/processRoleData";
import { formatTestId } from "@/utils/src/helpers"

const RoleFormPermissionsSelector = ({ roleName, module, permissions, onPermissionChange, onToggleAllInRole }) => {
    const { t } = useTranslation();
    const areAllPermissionsChecked = useMemo(() => {
        if (!permissions || permissions.length === 0) return false;
        const checkedCount = permissions.filter((p) => p.granted).length;
        if (checkedCount > 0 && checkedCount < permissions.length) {
            return "indeterminate";
        }
        return permissions.every((p) => p.granted);
    }, [permissions]);

    const handleToggleAll = useCallback(() => {
        onToggleAllInRole(module, roleName, !areAllPermissionsChecked);
    }, [module, roleName, areAllPermissionsChecked, onToggleAllInRole]);

    const capitalizedRoleName = t(`modulesNames.${roleName}`, formatModuleName(roleName));

    return (
        <Card>
            <CardHeader className="flex flex-row items-center gap-2">
                <CardTitle className="text-xl font-bold" id={formatTestId("role_permissions", `${capitalizedRoleName}`)} data-testid={formatTestId("role_permissions", `${capitalizedRoleName}`)}>{capitalizedRoleName}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
                <div className="flex items-center gap-2 cursor-pointer pb-2 mb-2 border-b" id="role_permissions_content" data-testid="role_permissions_content">
                    <Checkbox
                        id={`toggle-all-${roleName}`}
                        checked={areAllPermissionsChecked}
                        onCheckedChange={handleToggleAll}
                        data-testid={formatTestId("role_toggle_all", `${roleName}`)}
                    />
                    <Label htmlFor={`toggle-all-${roleName}`} className="font-semibold" id={formatTestId("role_toggle_label", `${roleName}`)}
                        data-testid={formatTestId("role_toggle_label", `${roleName}`)}>
                        {t("rol.form.labels.selectAll")}
                    </Label>
                </div>
                <div className="space-y-1">
                    {permissions.map((permission) => (
                        <RoleFormPermissionsCheckbox
                            key={`${permission.module_id}-${permission.name}`}
                            permissionName={permission.name}
                            description={permission.description}
                            checked={permission.granted}
                            onCheckedChange={onPermissionChange}
                        />
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

RoleFormPermissionsSelector.propTypes = {
    roleName: PropTypes.string.isRequired,
    module: PropTypes.string.isRequired,
    permissions: PropTypes.arrayOf(
        PropTypes.shape({
            module_id: PropTypes.string.isRequired,
            description: PropTypes.string.isRequired,
            granted: PropTypes.bool.isRequired,
            name: PropTypes.string.isRequired,
        }),
    ).isRequired,
    onPermissionChange: PropTypes.func.isRequired,
    onToggleAllInRole: PropTypes.func.isRequired,
};

export default RoleFormPermissionsSelector;

import { useCallback } from "react";
import PropTypes from "prop-types";
import { Checkbox } from "@/components/ui-shared";
import { Label } from "@/componentsV2/core/Label";

const RoleFormPermissionsCheckbox = ({
    permissionName,
    description,
    checked,
    onCheckedChange,
}) => {
    const handleWrapperClick = useCallback(() => {
        onCheckedChange(permissionName, !checked);
    }, [permissionName, checked, onCheckedChange]);

    return (
        <div
            className="flex w-full items-center gap-2 cursor-pointer py-1"
        >
            <Checkbox
                id={permissionName}
                checked={checked}
                onCheckedChange={handleWrapperClick}
                data-testid="role_permission_check"
            />
            <Label
                htmlFor={permissionName}
                className="text-left text-sm"
                data-testid="role_permission_description"
                id="role_permission_description"
            >
                {description}
            </Label>
        </div>
    );
};

RoleFormPermissionsCheckbox.propTypes = {
    permissionName: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    checked: PropTypes.bool.isRequired,
    onCheckedChange: PropTypes.func.isRequired,
};

export default RoleFormPermissionsCheckbox;
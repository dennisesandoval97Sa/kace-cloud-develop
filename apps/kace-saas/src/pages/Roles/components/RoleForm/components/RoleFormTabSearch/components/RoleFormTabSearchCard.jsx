import React from "react";
import PropTypes from "prop-types";
import { Badge, Checkbox } from "@/components/ui-shared";
import RoleFormTabSearchSelectButtons from "./RoleFormTabSearchSelectButtons";
import { formatTestId } from "@/utils/src/helpers";

const RoleFormTabSearchCard = ({ module, handleModuleSelectAll = () => {}, handlePermissionToggle = () => {} }) => {
    return (
        <div
            key={module.id}
            className="border rounded-lg p-4 hover:shadow-sm transition-shadow bg-white"
            id={formatTestId("role_form_tab_search_card", `${module.name}`)}
            data-testid={formatTestId("role_form_tab_search_card", `${module.name}`)}
        >
            <div
                className="flex items-center justify-between mb-3"
                id={formatTestId("role_form_search_card_header", `${module.name}`)}
                data-testid={formatTestId("role_form_search_card_header", `${module.name}`)}
            >
                <h3
                    className="font-medium text-gray-900 text-sm truncate"
                    id={formatTestId("role_form_search_card_title", `${module.name}`)}
                    data-testid={formatTestId("role_form_search_card_title", `${module.name}`)}
                >
                    {module.name}
                </h3>
                <Badge
                    variant={module.selected > 0 ? "default" : "outline"}
                    className="text-xs shrink-0"
                    id={formatTestId("role_form_search_card_badge", `${module.selected}`)}
                    data-testid={formatTestId("role_form_search_card_badge", `${module.selected}`)}
                >
                    {module.selected}/{module.permissions?.length}
                </Badge>
            </div>

            <RoleFormTabSearchSelectButtons moduleId={module.id} handler={handleModuleSelectAll} />

            <div
                className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2"
                id={formatTestId("role_form_search_card_permissions", `${module.name}`)}
                data-testid={formatTestId("role_form_search_card_permissions", `${module.name}`)}
            >
                {module.permissions.map((permission, index) => (
                    <div
                        key={index}
                        className="flex items-center space-x-2"
                        id={formatTestId("role_form_card_permission", `${module.id}_${index}`)}
                        data-testid={formatTestId("role_form_card_permission", `${module.id}_${index}`)}
                    >
                        <Checkbox
                            id={`${module.id}-${index}`}
                            className="h-3 w-3 shrink-0"
                            checked={permission.granted}
                            onCheckedChange={() => handlePermissionToggle(module.id, permission.name)}
                            data-testid={formatTestId("btn_checkbox_permission", `${module.name}_${permission.name}`)}
                        />
                        <label
                            htmlFor={`${module.id}-${index}`}
                            className="text-xs text-gray-700 cursor-pointer"
                            title={permission.label}
                            id={formatTestId("label_permission", `${module.id}_${index}`)}
                            data-testid={formatTestId("label_permission", `${module.id}_${index}`)}
                        >
                            {permission.label}
                        </label>
                    </div>
                ))}
            </div>
        </div>
    );
};

RoleFormTabSearchCard.propTypes = {
    module: PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        permissions: PropTypes.arrayOf(
            PropTypes.shape({
                description: PropTypes.string.isRequired,
                label: PropTypes.string.isRequired,
                granted: PropTypes.bool.isRequired,
                module_id: PropTypes.string.isRequired,
                name: PropTypes.string.isRequired,
            }).isRequired,
        ).isRequired,
        selected: PropTypes.number.isRequired,
    }).isRequired,
    handleModuleSelectAll: PropTypes.func,
    handlePermissionToggle: PropTypes.func,
};

export default RoleFormTabSearchCard;

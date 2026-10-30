import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui-shared";

const RoleFormTabSearchSelectAll = ({ isChecked = false, handler = () => { } }) => {
    const { t } = useTranslation();
    return (
        <div className="flex items-center space-x-2 px-3 py-2 border rounded-md bg-gray-50" id="role_form_tab_search_select_all" data-testid="role_form_tab_search_select_all">
            <Checkbox id="global-select-all" checked={isChecked} onCheckedChange={handler} className="h-4 w-4" data-testid="role_checkbox_global_select_all" />
            <label htmlFor="global-select-all" className="text-sm font-medium cursor-pointer" data-testid="label_global_select_all" id="label_global_select_all">
                {t("rol.form.labels.selectAll")}
            </label>
        </div>
    );
};

RoleFormTabSearchSelectAll.propTypes = {
    isChecked: PropTypes.bool,
    handler: PropTypes.func,
};

export default RoleFormTabSearchSelectAll;

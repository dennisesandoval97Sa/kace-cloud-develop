import React from "react";
import PropTypes from "prop-types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui-shared";
import { Filter } from "lucide-react";
import { useTranslation } from "react-i18next";

const RoleFormTabSearchFilters = ({ value = "", handler = () => { } }) => {
    const { t } = useTranslation();
    return (
        <Select value={value} onValueChange={handler} id="role_form_tab_search_filters" data-testid="role_form_tab_search_filters">
            <SelectTrigger className="w-48" id={`role_form_search_filters_trigger_${value}`} data-testid={`role_form_search_filters_trigger_${value}`}>
                <Filter className="h-4 w-4 mr-2" id="role_form_search_filters_icon" data-testid="role_form_search_filters_icon" />
                <SelectValue id={`role_form_search_filter_value_${value}`} data-testid={`role_form_search_filter_value_${value}`} />
            </SelectTrigger>
            <SelectContent id="role_form_tab_search_filters_content" data-testid="role_form_tab_search_filters_content">
                <SelectItem value="all" id="role_form_tab_search_filters_all" data-testid="role_form_tab_search_filters_all" >{t("rol.form.labels.allModules")}</SelectItem>
                <SelectItem value="selected" id="role_form_tab_search_filters_selected" data-testid="role_form_tab_search_filters_selected" >{t("rol.form.labels.seletedPermissions")}</SelectItem>
                <SelectItem value="unselected" id="role_form_tab_search_filters_unselected" data-testid="role_form_tab_search_filters_unselected" >{t("rol.form.labels.notSelectedPermissions")}</SelectItem>
            </SelectContent>
        </Select>
    );
};

RoleFormTabSearchFilters.propTypes = {
    value: PropTypes.string,
    handler: PropTypes.func,
};

export default RoleFormTabSearchFilters;

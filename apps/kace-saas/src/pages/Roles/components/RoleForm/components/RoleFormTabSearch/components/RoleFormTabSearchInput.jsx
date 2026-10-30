import React from "react";
import PropTypes from "prop-types";
import { Search } from "lucide-react";
import { Input } from "@/components/ui-shared";
import { useTranslation } from "react-i18next";

const RoleFormTabSearchInput = ({ value = "", handler = () => { } }) => {
    const { t } = useTranslation();

    return (
        <div className="relative flex-1" id="role_form_tab_search_input_container" data-testid="role_form_tab_search_input_container">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" id="role_form_tab_search_input_icon" data-testid="role_form_tab_search_input_icon" />
            <Input
                placeholder={t("rol.placeholder.search")}
                value={value}
                onChange={(e) => handler(e.target.value)}
                className="pl-10"
                name="role_form_tab_search"
            />
        </div>
    );
};

RoleFormTabSearchInput.propTypes = {
    value: PropTypes.string,
    handler: PropTypes.func,
};

export default RoleFormTabSearchInput;

import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui-shared";
import { Check, X } from "lucide-react";

const RoleFormTabSearchSelectButtons = ({ moduleId = "", handler = () => { } }) => {
    const { t } = useTranslation();
    return (
        <div className="flex gap-1 mb-3">
            <Button
                size="sm"
                variant="ghost"
                type="button"
                className="text-xs h-7 px-2 flex-1 hover:bg-green-50 hover:text-green-700"
                onClick={() => handler(moduleId, true)}
                id="btn_role_all"
                data-testid="btn_role_all"
            >
                <Check className="h-3 w-3 mr-1" />
                {t("rol.form.labels.all")}
            </Button>
            <Button
                size="sm"
                variant="ghost"
                type="button"
                className="text-xs h-7 px-2 flex-1 hover:bg-red-50 hover:text-red-700"
                onClick={() => handler(moduleId, false)}
                id="btn_role_none"
                data-testid="btn_role_none"
            >
                <X className="h-3 w-3 mr-1" />
                {t("rol.form.labels.none")}
            </Button>
        </div>
    );
};

RoleFormTabSearchSelectButtons.propTypes = {
    moduleId: PropTypes.string,
    handler: PropTypes.func,
};

export default RoleFormTabSearchSelectButtons;

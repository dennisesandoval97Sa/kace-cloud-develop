import React from "react";
import PropTypes from "prop-types";
import { AlertCircle } from "lucide-react";
import Button from "@kace_v2/shared/ui/atoms/Button";
import { useTranslation } from "react-i18next";

const DataTableError = ({ handler = () => {} }) => {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col items-center justify-center w-full p-6 bg-background rounded-md shadow-md border border-redCustom gap-2">
            <div>
                <AlertCircle className="h-24 w-24 text-red-700" />
            </div>
            <h2 className="text-xl font-bold text-redCustom">{t("dataTable.errors.failedToLoad.title")}</h2>
            <div className="flex items-center space-x-3 text-redCustom">
                <span>{t("dataTable.errors.failedToLoad.description")}</span>
            </div>
            <div>
                <Button onClick={handler} className="bg-greenCustom">
                    {t("dataTable.buttons.reload")}
                </Button>
            </div>
        </div>
    );
};

DataTableError.propTypes = {
    handler: PropTypes.func,
};

export default DataTableError;

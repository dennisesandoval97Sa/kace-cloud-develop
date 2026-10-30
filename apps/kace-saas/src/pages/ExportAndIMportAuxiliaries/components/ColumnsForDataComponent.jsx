import PropTypes from "prop-types";
import { Columns3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MODULES } from "../data/Constants";
import useExportData from "../hooks/useExportData";
import { TogglesSelectColumnsComponent } from "./TogglesSelectColumnsComponent";

export const ColumnsForDataComponent = ({ module = null, setColumnsSelected, columnsSelected }) => {
    const { currentHeaders } = useExportData({ module });
    const isAuxDefinition = typeof module === "number" || (typeof module === "string" && !isNaN(module));
    const moduleObject = !isAuxDefinition ? MODULES[module] : null;
    const { t } = useTranslation();

    return (
        <div className="w-full flex flex-col justify-center items-center min-h-20 rounded-md border border-input gap-4 p-2">
            <h3
                className="text-lg font-semibold"
                id="columns_data_modules_title"
                data-testid="columns_data_modules_title"
            >
                {t("importExport.form.columnsByModules")}
            </h3>
            {module ? (
                <TogglesSelectColumnsComponent
                    currentHeaders={currentHeaders}
                    setColumnsSelected={setColumnsSelected}
                    columnsSelected={columnsSelected}
                    moduleObject={moduleObject}
                />
            ) : (
                <div className="w-full flex flex-col justify-center items-center gap-4">
                    <Columns3 height={50} width={50} />
                    <div className="flex flex-col justify-center items-center">
                        <p
                            className="text-lg font-semibold"
                            id="table_fields_no_module_selected"
                            data-testid="table_fields_no_module_selected"
                        >
                            {t("importExport.form.noModuleSelected")}
                        </p>
                        <p
                            className="text-sm text-gray-500"
                            id="table_fields_module_selected"
                            data-testid="table_fields_module_selected"
                        >
                            {t("importExport.form.selectModule")}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

ColumnsForDataComponent.propTypes = {
    module: PropTypes.string,
    setColumnsSelected: PropTypes.func,
    columnsSelected: PropTypes.array,
};

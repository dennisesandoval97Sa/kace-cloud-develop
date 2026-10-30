import { FilterX } from "lucide-react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { FILTERS_BY_MODULE } from "../data/Constants";

export const FiltersByModuleComponent = ({ module = null, setFieldValue, values }) => {
    const isAuxDefinition = typeof module === "number" || (typeof module === "string" && !isNaN(module));
    const currentModule = !isAuxDefinition ? FILTERS_BY_MODULE[module] : [];
    const { t } = useTranslation();
    return (
        <>
            {module && currentModule ? (
                <div className="w-full flex flex-col justify-center items-center min-h-20 rounded-md border border-input gap-4 p-2">
                    <h3
                        className="text-lg font-semibold"
                        id="filter_by_modules_title"
                        data-testid="filter_by_modules_title"
                    >
                        {t("importExport.form.filterByModules")}
                    </h3>
                </div>
            ) : (
                <div className="w-full flex flex-col justify-center items-center min-h-20 rounded-md border border-input gap-4 p-2">
                    <div className="w-full flex flex-col justify-center items-center gap-4">
                        <FilterX height={50} width={50} />
                        <div className="flex flex-col justify-center items-center">
                            <p
                                className="text-lg font-semibold"
                                id="filters_no_module_selected"
                                data-testid="filters_no_module_selected"
                            >
                                {t("importExport.form.noModuleSelected")}
                            </p>
                            <p
                                className="text-sm text-gray-500"
                                id="filters_module_selected"
                                data-testid="filters_module_selected"
                            >
                                {t("importExport.form.selectModule")}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

FiltersByModuleComponent.propTypes = {
    module: PropTypes.string,
    setFieldValue: PropTypes.func,
    values: PropTypes.object,
};

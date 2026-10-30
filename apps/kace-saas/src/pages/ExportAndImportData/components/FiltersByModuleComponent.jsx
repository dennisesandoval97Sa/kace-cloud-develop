import PropTypes from "prop-types"
import React from "react"
import { FILTERS_BY_MODULE } from "../data/Constants"
import { InputDependByModuleComponent } from "./InputDependByModuleComponent"
import { FilterX } from "lucide-react"
import { useTranslation } from "react-i18next"

export const FiltersByModuleComponent = ({ module = null, setFieldValue, values }) => {
    const currentModule = FILTERS_BY_MODULE[module]
    const { t } = useTranslation()
    return (
        <div className="w-full flex flex-col justify-center items-center min-h-20 rounded-md border border-input gap-4 p-2">
            <h3 className="text-lg font-semibold" id="filter_by_modules_title" data-testid="filter_by_modules_title">
                {t("importExport.form.filterByModules")}
            </h3>
            {module ? (
                <div className="flex flex-wrap justify-end overflow-auto">
                    {currentModule.map((item) => (
                        <InputDependByModuleComponent
                            objectModule={item}
                            key={item.column}
                            setFieldValue={setFieldValue}
                            value={values[item.column]}
                            id={`filter_by_modules_input_${item.column}`}
                            data-testid={`filter_by_modules_input_${item.column}`}
                        />
                    ))}
                </div>
            ) : (
                <div className="w-full flex flex-col justify-center items-center gap-4">
                    <FilterX height={50} width={50} />
                    <div className="flex flex-col justify-center items-center">
                        <p className="text-lg font-semibold" id="filters_no_module_selected"
                            data-testid="filters_no_module_selected">{t("importExport.form.noModuleSelected")}</p>
                        <p className="text-sm text-gray-500" id="filters_module_selected" data-testid="filters_module_selected" >{t("importExport.form.selectModule")}</p>
                    </div>
                </div>
            )}
        </div>
    );
}

FiltersByModuleComponent.propTypes = {
    module: PropTypes.string,
    setFieldValue: PropTypes.func,
    values: PropTypes.object
}

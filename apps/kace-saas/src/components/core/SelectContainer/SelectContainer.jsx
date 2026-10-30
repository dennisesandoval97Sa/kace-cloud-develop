import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@kace/ui-shared";
import { cn } from "../../ui-shared/src/lib/utils";
import PropTypes from "prop-types";
import { GeneralLoader } from "../../ui-shared/src/components/general-loader";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

export const SelectContainer = ({
    error = false,
    touched = false,
    isLoading = false,
    options = [],
    value,
    setFieldValue,
    name,
    ...props
}) => {
    const { t } = useTranslation();
    return (
        <div className="flex items-center gap-2">
            <Select
                onValueChange={(value) => {
                    setFieldValue(name, value);
                }}
                value={value}
                {...props}
            >
                <SelectTrigger className={cn("w-full", error && touched && "border-redCustom text-redCustom")}>
                    <SelectValue placeholder={isLoading ? "Cargando..." : t("app.forms.options")} />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup defaultValue={value}>
                        <SelectLabel>Opciones</SelectLabel>
                        {isLoading ? (
                            <div className="flex justify-center items-center p-4 h-36 w-full">
                                <GeneralLoader />
                            </div>
                        ) : options?.length === 0 ? (
                            <div className="flex justify-center items-center p-4">
                                <p>No hay opciones disponibles</p>
                            </div>
                        ) : (
                            options.map((option, index) => (
                                <SelectItem value={option.value} key={`${option.value}${index}`}>
                                    <span className="flex gap-2 items-center">
                                        {option.icon} {t(`fieldsClient.${option.label}`, option.label)}
                                    </span>
                                </SelectItem>
                            ))
                        )}
                    </SelectGroup>
                </SelectContent>
            </Select>
            {value && (
                <X
                    className="h-4 w-4 opacity-60 hover:opacity-100 cursor-pointer"
                    onClick={() => setFieldValue(name, "")}
                />
            )}
        </div>
    );
};

SelectContainer.propTypes = {
    error: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
    touched: PropTypes.bool,
    isLoading: PropTypes.bool,
    options: PropTypes.array,
    value: PropTypes.string,
    setFieldValue: PropTypes.func,
    name: PropTypes.string,
};

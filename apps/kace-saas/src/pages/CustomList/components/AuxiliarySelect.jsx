import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import PropTypes from "prop-types";
import { toast } from "sonner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui-shared/src/components/ui/select";
import { Button, Label } from "@kace/ui-shared";
import useGenericGetQuery from "@/hooks/useGenericGetQuery";
import { LoaderThreeDots } from "@/components/ui-shared/src/components/LoaderThreeDots";
import { getTranslatedError } from "@/utils/getTranslatedError";

/**
 * Componente para seleccionar un Auxiliar de un schema específico
 * Carga auxiliares filtrados por un campo específico (data_path)
 */
const AuxiliarySelect = ({
    schemaName,
    dataPath,
    value,
    onChange,
    error,
    touched,
    handlerAddAuxiliary = () => {},
    isReady = true,
}) => {
    const { t } = useTranslation();

    /**
     * Extrae lo que viene después del primer punto
     * Ejemplo: "data.nombre" -> "nombre"
     */
    const getFieldSuffix = (path) => {
        if (!path) return "";
        const parts = path.split(".");
        // Si hay un punto, retornar todo lo que viene después del primero
        if (parts.length > 1) {
            return parts.slice(1).join(".");
        }
        // Si no hay punto, retornar el path completo
        return path;
    };

    // Construir la URL del endpoint con el parámetro field truncado
    const apiUrl = useMemo(() => {
        if (!schemaName || !dataPath) return null;
        const fieldSuffix = getFieldSuffix(dataPath);
        return `/auxiliaries/${schemaName}/list?field=${encodeURIComponent(fieldSuffix)}`;
    }, [schemaName, dataPath]);

    // Query para obtener auxiliares del schema seleccionado filtrados por campo (usando GET)
    const {
        data: auxiliariesData,
        isFetching,
        isError,
        error: queryError,
    } = useGenericGetQuery({
        url: apiUrl,
        keyQuery: apiUrl ? `auxiliaries-${schemaName}-${getFieldSuffix(dataPath)}` : null,
        select: (response) => {
            // La respuesta tiene estructura anidada: { data: { data: [...] } }
            if (response?.data?.data && Array.isArray(response.data.data)) {
                return response.data.data;
            }
            // Fallback por si la estructura es diferente
            if (response?.data && Array.isArray(response.data)) {
                return response.data;
            }
            return [];
        },
        enabled: !!(schemaName && dataPath && isReady),
    });

    const errorStatus = queryError?.response?.status ?? queryError?.status;
    const isForbidden = errorStatus === 403;

    // Notificar al usuario por qué no cargan las opciones (permisos vs error de carga)
    useEffect(() => {
        if (!isError) return;
        if (isForbidden) {
            toast.error(
                t(
                    "customLists.form.errors.loadForbidden",
                    "You don't have permission to query this auxiliary. Request read permission on your role.",
                ),
            );
        } else {
            toast.error(getTranslatedError(queryError, t));
        }
    }, [isError, apiUrl]);

    /*
     * Preparar opciones para Select
     * auxiliariesData es un arreglo de valores primitivos (strings o números)
     */
    const options = useMemo(() => {
        if (!auxiliariesData || !Array.isArray(auxiliariesData)) return [];

        const opts = auxiliariesData.map((item) => ({
            id: String(item),
            label: String(item),
            value: String(item),
        }));

        return opts;
    }, [auxiliariesData]);

    const handleValueChange = (selectedValue) => {
        if (onChange) {
            // Llamar onChange con el valor seleccionado
            onChange(selectedValue, selectedValue);
        }
    };

    // Si no hay schema o dataPath seleccionado, mostrar mensaje
    if (!schemaName) {
        return (
            <div className="flex flex-col justify-stretch w-full">
                <Label className="text-sm font-medium mb-2">{t("customLists.form.labels.options", "Options")}</Label>
                <div className="px-4 py-3 text-sm text-gray-500 border border-gray-300 rounded-md bg-gray-50">
                    {t("customLists.form.selectSchemaFirst", "Select a schema first")}
                </div>
            </div>
        );
    }

    if (!dataPath) {
        return (
            <div className="flex flex-col justify-stretch w-full">
                <Label className="text-sm font-medium mb-2">{t("customLists.form.labels.options", "Options")}</Label>
                <div className="px-4 py-3 text-sm text-gray-500 border border-gray-300 rounded-md bg-gray-50">
                    {t("customLists.form.selectFieldFirst", "Select a field first")}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col justify-stretch w-full">
            <Label className={`text-sm font-medium mb-2 ${error && touched ? "text-red-500" : ""}`}>
                {t("customLists.form.labels.options", "Options")}
            </Label>
            <div className="w-full flex gap-3">
                {isError ? (
                    <div className="w-full px-4 py-3 text-sm text-red-600 border border-red-300 rounded-md bg-red-50">
                        {isForbidden
                            ? t(
                                  "customLists.form.errors.loadForbidden",
                                  "You don't have permission to query this auxiliary. Request read permission on your role.",
                              )
                            : t(
                                  "customLists.form.errors.loadFailed",
                                  "Could not load the auxiliary options. Check that the field path is valid.",
                              )}
                    </div>
                ) : (
                    <Select
                        key={value || "empty"}
                        value={value || ""}
                        onValueChange={handleValueChange}
                        disabled={isFetching}
                    >
                        <SelectTrigger className="w-full">
                            {isFetching ? (
                                <LoaderThreeDots />
                            ) : (
                                <SelectValue placeholder={t("customLists.form.selectAuxiliary", "Select an option")} />
                            )}
                        </SelectTrigger>
                        <SelectContent>
                            {options.length === 0 ? (
                                <SelectItem value="__no_options__" disabled>
                                    {isFetching
                                        ? t("genericTexts.loading", "Loading...")
                                        : t("genericTexts.noFoundInformation", "No options found")}
                                </SelectItem>
                            ) : (
                                options.map((option) => (
                                    <SelectItem key={option.id} value={option.value} id={`option-${option.id}`}>
                                        {option.label}
                                    </SelectItem>
                                ))
                            )}
                        </SelectContent>
                    </Select>
                )}
                <Button type="button" onClick={() => handlerAddAuxiliary()} variant="outline">
                    {t("button.add")}
                </Button>
            </div>
            {error && touched && <span className="text-sm text-red-500 mt-1">{error}</span>}
        </div>
    );
};

AuxiliarySelect.propTypes = {
    schemaName: PropTypes.string,
    dataPath: PropTypes.string,
    value: PropTypes.string,
    onChange: PropTypes.func.isRequired,
    error: PropTypes.string,
    touched: PropTypes.bool,
    handlerAddAuxiliary: PropTypes.func,
    isReady: PropTypes.bool,
};

export default AuxiliarySelect;

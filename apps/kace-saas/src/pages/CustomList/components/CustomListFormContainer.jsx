import AuxFieldSelect from "@/pages/Auxiliaries/components/Schemas/components/SourcesTab/components/AuxFieldSelect";
import { formatTestId } from "@/utils/src/helpers";
import { Label } from "@kace/ui-shared";
import { PropTypes } from "prop-types";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import AuxiliarySelect from "./AuxiliarySelect";
import { AuxSelectWrapper } from "./AuxSelectWrapper";

/**
 * Componente contenedor que gestiona la selección de auxiliares en cascada.
 * Coordina tres selectores: Esquema de Auxiliar -> Campo de Datos -> Auxiliar específico.
 * Implementa lógica de dependencia entre selectores y limpieza de valores.
 *
 * @component
 * @param {Object} props - Propiedades del componente
 * @param {string} props.text - Texto label para el selector de esquema
 * @param {Object} props.values - Valores actuales del formulario Formik
 * @param {Function} props.setFieldValue - Función de Formik para actualizar valores
 * @param {Object} props.errors - Objeto de errores de validación de Formik
 * @param {Object} props.touched - Objeto de campos tocados de Formik
 * @param {Function} props.handlerAddAuxiliary - Handler para agregar auxiliar a la lista
 * @param {boolean} props.isInitialized - Flag para evitar renderizado prematuro en modo edición
 * @returns {JSX.Element} Contenedor con selectores en cascada
 */
export const CustomListsFormContainer = ({
    text,
    values,
    setFieldValue,
    errors,
    touched,
    handlerAddAuxiliary,
    isInitialized = true,
}) => {
    // Hook de traducción i18n
    const { t } = useTranslation();

    // Estado para guardar el schema_id que necesita AuxFieldSelect
    const [selectedSchemaId, setSelectedSchemaId] = useState(null);

    /*
     * Estado para controlar si el usuario ha interactuado manualmente con el segundo select
     * En modo edición, aunque data_path exista, el tercer select NO debe aparecer hasta que el usuario lo seleccione
     */
    const [userHasSelectedPath, setUserHasSelectedPath] = useState(false);

    // Efecto para sincronizar el schema_id cuando se carga el formulario en modo edición
    useEffect(() => {
        /*
         * Cuando se carga un registro existente, setear el selectedSchemaId
         * para que el AuxFieldSelect funcione correctamente
         */
        if (values.schema_id) {
            setSelectedSchemaId(values.schema_id);
        }
    }, [values.schema_id]);

    // Efecto para resetear userHasSelectedPath cuando cambia el schema o no hay isInitialized
    useEffect(() => {
        if (!isInitialized || !selectedSchemaId) {
            setUserHasSelectedPath(false);
        }
    }, [isInitialized, selectedSchemaId]);

    /**
     * Maneja el cambio de esquema auxiliar seleccionado.
     * Actualiza el schema_id y aux_entity, limpia los campos dependientes.
     *
     * @param {string} auxDefinitionId - ID del aux_definition seleccionado
     * @param {Object} schema - Objeto completo del esquema con sus propiedades
     */
    const handleSchemaChange = (auxDefinitionId, schema) => {
        // Setear el aux_definition_id (ID del aux-definition)
        setFieldValue("aux_definition_id", auxDefinitionId);
        // Setear el schema_id (ID del schema al que pertenece)
        setFieldValue("schema_id", schema?.schema_id || "");
        // Setear el aux_entity (nombre del schema)
        setFieldValue("aux_entity", schema?.name || "");

        // Guardar el schema_id del schema para AuxFieldSelect
        setSelectedSchemaId(schema?.schema_id || null);

        // Resetear la bandera de interacción del usuario
        setUserHasSelectedPath(false);

        // Limpiar el campo y el auxiliar cuando cambie el schema
        setFieldValue("data_path", "");
        setFieldValue("aux_id", "");
        setFieldValue("aux_name", "");
    };

    /**
     * Maneja el cambio de ruta del campo de datos seleccionado.
     * Limpia el auxiliar seleccionado cuando cambia el campo.
     *
     * @param {string} fieldPath - Ruta del campo seleccionado (ej: "data.nombre")
     */
    const handleFieldPathChange = (fieldPath) => {
        // Setear el data_path
        setFieldValue("data_path", fieldPath);

        // Marcar que el usuario ha seleccionado manualmente un path
        setUserHasSelectedPath(true);

        // Limpiar el auxiliar cuando cambie el field path
        setFieldValue("aux_id", "");
        setFieldValue("aux_name", "");
    };

    /**
     * Maneja el cambio de auxiliar seleccionado.
     * Actualiza aux_id y aux_name con los datos del auxiliar.
     *
     * @param {string} auxId - ID del auxiliar seleccionado
     * @param {Object} auxiliary - Objeto completo del auxiliar con sus propiedades
     */
    const handleAuxiliaryChange = (auxId, auxiliary) => {
        // Setear el aux_id y aux_name
        setFieldValue("aux_id", auxId);
        setFieldValue("aux_name", auxiliary?.data?.nombre || auxiliary?.name || "");
    };

    return (
        <div className="flex flex-col w-full gap-4 my-2">
            {/* Select para Aux Definitions usando AuxSelectWrapper */}
            <div className="flex flex-col w-full items-center gap-3">
                <div className="flex-1 w-full">
                    {/* Este input permite seleccionar los auxiliares disponibles */}
                    <AuxSelectWrapper
                        value={values.aux_definition_id}
                        onChange={handleSchemaChange}
                        showLabel={true}
                        error={errors.schema_id}
                        touched={touched.schema_id}
                        variant="outline"
                    />
                </div>
            </div>

            {/* Select para Field Path usando AuxFieldSelect - Solo visible si hay schema y schema_id */}
            {isInitialized && values.aux_entity && selectedSchemaId && (
                <div className="flex flex-col w-full items-center gap-3">
                    <Label
                        htmlFor="fieldPath"
                        className="text-left text-sm w-full"
                        id={formatTestId("select_field_path", "fieldPath")}
                        data-testid={formatTestId("select_field_path", "fieldPath")}
                    >
                        {t("customLists.form.labels.auxField")}
                    </Label>
                    <div className="flex-1 w-full">
                        {/* Este input permite seleccionar los path disponibles*/}
                        <AuxFieldSelect
                            selectedAuxSchemaId={selectedSchemaId}
                            selectedAuxField={values.data_path}
                            onChangeAuxField={handleFieldPathChange}
                            error={errors.data_path}
                            touched={touched.data_path}
                            showLabel={false}
                        />
                    </div>
                </div>
            )}

            {/* Select para Auxiliaries usando AuxiliarySelect - Solo visible si el usuario seleccionó manualmente un path */}
            {isInitialized && userHasSelectedPath && values.aux_entity && values.data_path && (
                <div className="flex flex-col w-full items-start gap-[17.5%]">
                    {/* Este input permite seleccionar los datos disponibles del campo seleccionado*/}
                    <AuxiliarySelect
                        schemaName={values.aux_entity}
                        dataPath={values.data_path}
                        value={values.aux_id}
                        onChange={handleAuxiliaryChange}
                        error={errors.aux_id}
                        touched={touched.aux_id}
                        handlerAddAuxiliary={handlerAddAuxiliary}
                    />
                </div>
            )}
        </div>
    );
};

CustomListsFormContainer.propTypes = {
    text: PropTypes.string.isRequired,
    values: PropTypes.object.isRequired,
    setFieldValue: PropTypes.func.isRequired,
    errors: PropTypes.object,
    touched: PropTypes.object,
    handlerAddAuxiliary: PropTypes.func,
    isInitialized: PropTypes.bool,
};

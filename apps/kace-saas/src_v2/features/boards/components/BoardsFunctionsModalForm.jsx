import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import CreateModalButton from "@kace_v2/shared/ui/molecules/CreateModalButton";
import { BOARDS_FUNCTIONS } from "@kace_v2/features/boards/constants/boards.constants";
import { Form, Formik } from "formik";
import { joiFormikAdapter } from "@kace/utils";
import { validateBoardsFunctions } from "@kace_v2/features/boards/schemas/boards.schema";
import SelectField from "@kace_v2/shared/ui/molecules/SelectField";
import { fetchSchemaRules } from "@kace_v2/shared/services/schemas.services";
import { generateAuxSelectOptions } from "@/utils/generateAuxSelectOptions";
import useSchemaFields from "@kace/hooks/useSchemaFields";
import { processAuxiliaryOptions } from "@kace_v2/features/boards/utils/auxiliaryOptions.util";
import InputField from "@kace_v2/shared/ui/molecules/InputField";
import Button from "@kace_v2/shared/ui/atoms/Button";
import { functionsTypeOptions } from "@kace_v2/features/boards/utils/functionsTypeOptions.util";

const BoardsFunctionsModalForm = ({
    defaultValues,
    relationsOptions = [],
    disabled = false,
    open = false,
    setOpen = () => {},
    onSubmit = () => {},
}) => {
    const { getSchemaField } = useSchemaFields();

    const [initialValues, setInitialValues] = useState(defaultValues || BOARDS_FUNCTIONS.INITIAL_VALUES);
    const [fieldOptions, setFieldOptions] = useState([]);

    useEffect(() => {
        setInitialValues(defaultValues || BOARDS_FUNCTIONS.INITIAL_VALUES);
    }, [defaultValues]);

    return (
        <CreateModalButton
            title="Funciones"
            description="Configura las funciones agregación para tu tablero"
            label="Función"
            className="sm:max-w-2xl"
            open={open}
            onOpenChange={(value) => {
                if (!value) {
                    setInitialValues(BOARDS_FUNCTIONS.INITIAL_VALUES);
                }
                setOpen(value);
            }}
            disabled={disabled}
        >
            <Formik
                initialValues={initialValues}
                validationSchema={joiFormikAdapter(validateBoardsFunctions)}
                onSubmit={onSubmit}
                enableReinitialize={true}
            >
                {({ setFieldValue, values, errors }) => {
                    return (
                        <Form autoComplete="off" className="flex flex-col gap-4">
                            <SelectField
                                label="Función"
                                name="function"
                                value={values.function}
                                placeholder="Seleccione..."
                                error={errors?.function ?? ""}
                                options={functionsTypeOptions()}
                                onValueChange={(value) => {
                                    setFieldValue("function", value);
                                }}
                            />

                            <SelectField
                                label="Entidad"
                                name="related_entity"
                                value={values.related_entity}
                                placeholder="Seleccione..."
                                error={errors?.related_entity ?? ""}
                                options={relationsOptions}
                                onValueChange={async (related_entity) => {
                                    setFieldValue("related_entity", related_entity);

                                    if (related_entity.includes("aux_")) {
                                        const auxiliary = await fetchSchemaRules(related_entity);
                                        const options = generateAuxSelectOptions(auxiliary, () => {}, related_entity);
                                        const processedOptions = processAuxiliaryOptions(options, related_entity);
                                        setFieldOptions(processedOptions);
                                        return;
                                    }

                                    const schemaField = getSchemaField(related_entity);
                                    setFieldOptions(
                                        schemaField.map((field) => ({
                                            label: field.column_name,
                                            value: `${related_entity}.${field.column_name}`,
                                        })),
                                    );
                                }}
                            />

                            {values.related_entity && fieldOptions.length > 0 && (
                                <SelectField
                                    label="Columna"
                                    name="field"
                                    value={values.field}
                                    placeholder="Seleccione..."
                                    error={errors?.field ?? ""}
                                    options={fieldOptions}
                                    onValueChange={(value) => {
                                        setFieldValue("field", value);
                                    }}
                                />
                            )}

                            <InputField
                                label="Alias"
                                name="alias"
                                defaultValue={values.alias}
                                onChange={(e) => {
                                    setFieldValue("alias", e.target.value);
                                }}
                                placeholder="alias"
                                error={errors?.alias ?? ""}
                            />

                            <div className="flex items-center justify-center">
                                <Button
                                    size="sm"
                                    type="submit"
                                    className="w-52"
                                    disabled={Object.entries(errors).length > 0}
                                >
                                    Agregar
                                </Button>
                            </div>
                        </Form>
                    );
                }}
            </Formik>
        </CreateModalButton>
    );
};

BoardsFunctionsModalForm.propTypes = {
    defaultValues: PropTypes.object,
    relationsOptions: PropTypes.array,
    disabled: PropTypes.bool,
    open: PropTypes.bool,
    setOpen: PropTypes.func,
    onSubmit: PropTypes.func,
};

export default BoardsFunctionsModalForm;

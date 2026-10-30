import { useTranslation } from "react-i18next";
import { FieldArray, useFormikContext } from "formik";
import { PropTypes } from "prop-types";
import { useCallback, useMemo, useState } from "react";
import { Button, InputForm as Input } from "@/components/ui-shared";
import { DataTableContainer } from "@/components/ui-shared/src/components/table-component/DataTableContainer";
import EditFieldModal from "./EditFieldModal";
import { getDynamicFieldsColumns } from "../utils/getDynamicFieldsColumns";

const DynamicFormFields = ({ name }) => {
    const { t } = useTranslation();
    const { values, errors, setFieldValue } = useFormikContext();
    const [fieldsQuery, setFieldsQuery] = useState();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingFieldIndex, setEditingFieldIndex] = useState(null);
    const [isNewField, setIsNewField] = useState(false);
    const [originalFieldValues, setOriginalFieldValues] = useState(null);

    const handleEdit = (index) => {
        setEditingFieldIndex(index);
        setIsNewField(false);
        const originalField = values?.fields?.[index];
        if (originalField) {
            setOriginalFieldValues(JSON.parse(JSON.stringify(originalField)));
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = useCallback(
        (saved = false) => {
            if (editingFieldIndex === null) {
                setIsModalOpen(false);
                return;
            }

            const currentField = values?.fields?.[editingFieldIndex];
            const fieldName = currentField?.name?.trim() || "";
            const hasValidName = fieldName.length > 0;

            if (isNewField && !saved) {
                const updatedFields = values.fields.filter((_, fieldIndex) => fieldIndex !== editingFieldIndex);
                setFieldValue("fields", updatedFields);
                setIsModalOpen(false);
                setEditingFieldIndex(null);
                setIsNewField(false);
                return;
            }

            if (isNewField && saved && !hasValidName) {
                const updatedFields = values.fields.filter((_, fieldIndex) => fieldIndex !== editingFieldIndex);
                setFieldValue("fields", updatedFields);
                setIsModalOpen(false);
                setEditingFieldIndex(null);
                setIsNewField(false);
                return;
            }

            if (!isNewField && currentField) {
                if (saved) {
                    const cleanedField = {};
                    Object.keys(currentField).forEach((key) => {
                        const value = currentField[key];
                        if (value !== "") {
                            cleanedField[key] = value;
                        }
                    });

                    const updatedFields = [...values.fields];
                    updatedFields[editingFieldIndex] = cleanedField;
                    setFieldValue("fields", updatedFields);
                } else {
                    if (originalFieldValues) {
                        const updatedFields = [...values.fields];
                        updatedFields[editingFieldIndex] = originalFieldValues;
                        setFieldValue("fields", updatedFields);
                    }
                }
            }

            setIsModalOpen(false);
            setEditingFieldIndex(null);
            setIsNewField(false);
            setOriginalFieldValues(null);
        },
        [editingFieldIndex, values?.fields, isNewField, setFieldValue, originalFieldValues],
    );

    const dataTableItems = useMemo(
        () =>
            values?.fields
                ?.filter(
                    (field) => !fieldsQuery?.length || field.name.toLowerCase().indexOf(fieldsQuery.toLowerCase()) >= 0,
                )
                ?.map((field, index) => ({
                    ...field,
                    __realIndex: values.fields.findIndex((f) => f.name === field.name),
                    bgColor: errors.fields?.[index] !== undefined ? "#e0907a" : "",
                })) || [],
        [values?.fields, fieldsQuery, errors?.fields],
    );
    return (
        <FieldArray name={name}>
            {({ push, remove }) => (
                <div className="flex flex-col gap-4">
                    <div className="flex justify-between">
                        <Input
                            label={t("app.title.filter")}
                            placeholder={t("app.title.filter")}
                            onChange={(e) => setFieldsQuery(e.target.value)}
                        />
                        <Button
                            type="button"
                            onClick={() => {
                                const newFieldIndex = values.fields.length;
                                push({ name: "", type: "string", required: false, default: null });
                                setIsNewField(true);
                                setEditingFieldIndex(newFieldIndex);
                                setOriginalFieldValues(null);
                                setIsModalOpen(true);
                            }}
                        >
                            {t("auxSchema.actions.addField")}
                        </Button>
                    </div>
                    <DataTableContainer
                        showUpdateButton={false}
                        showFilterGeneric={false}
                        showColumnsButton={false}
                        columns={getDynamicFieldsColumns({ handleEdit, remove, t })}
                        dataTable={dataTableItems}
                        view={{
                            url: "",
                            schema: "",
                            key: "",
                            keySchema: "",
                            view: "",
                        }}
                        autoResetPageIndex={false}
                    />

                    <EditFieldModal
                        isOpen={isModalOpen}
                        index={editingFieldIndex}
                        onClose={(saved) => handleCloseModal(saved)}
                        onSave={() => handleCloseModal(true)}
                    />
                </div>
            )}
        </FieldArray>
    );
};

DynamicFormFields.propTypes = {
    name: PropTypes.string.isRequired,
};

export default DynamicFormFields;

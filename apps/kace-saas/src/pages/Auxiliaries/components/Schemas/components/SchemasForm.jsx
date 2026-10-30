import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Formik, Form } from "formik";
import { PropTypes } from "prop-types";

import { joiFormikAdapter } from "@kace/utils";
import { KField, InputForm as Input } from "@kace/ui-shared";

import DynamicFormFields from "./DynamicFormFields";
import SchemasRelatedConfirmationModal from "./SchemasRelatedConfirmationModal";
import {
    validateString,
    validateNumber,
    validateBoolean,
    validateDate,
    inferTransformOnLoad,
} from "../utils/fieldValidations";
import InputCard from "@/components/core/Cards/InputCard";
import SectionForm from "@/components/core/Cards/section-form";
import { SwitchStateAdmin } from "@/components/core/switchState/SwitchStateAdmin";
import FormCard from "@/components/core/Cards/FormCard";
import { AuxSchemaCreateSchema } from "@/schemas/AuxSchemasSchema";

const AuxSchemasForm = ({ dataHandler, data = {}, hasRelationships = false, isSending = false }) => {
    const { t } = useTranslation();
    const [showRelatedModal, setShowRelatedModal] = useState(false);

    const arrayToString = (arr) => {
        const safeArray = arr ?? [];
        return Array.isArray(safeArray) ? safeArray.join(", ") : safeArray;
    };

    const formData = useMemo(
        () => ({
            ...data,
            fields: data?.data_structure
                ? Object.keys(data.data_structure).map((name) => {
                      const fieldData = { ...data.data_structure[name] };

                      if (fieldData.type === "boolean") {
                          fieldData.truthyValues = arrayToString(fieldData?.truthyValues);
                          fieldData.falsyValues = arrayToString(fieldData?.falsyValues);
                      }

                      if (fieldData.type === "number") {
                          const positive = !!fieldData?.positive;
                          const negative = !!fieldData?.negative;

                          fieldData.numberSign =
                              positive && !negative ? "positive" : !positive && negative ? "negative" : "both";

                          fieldData.valid = arrayToString(fieldData?.valid);
                          fieldData.invalid = arrayToString(fieldData?.invalid);
                      }

                      if (fieldData.type === "date") {
                          if (fieldData?.iso) {
                              fieldData.timezoneFormat = fieldData?.timezoneFormat ?? "withoutTimezone";
                          } else {
                              fieldData.timestamp = fieldData?.timestamp ?? "javascript";
                          }
                      }

                      if (fieldData.type === "string") {
                          fieldData.valid = arrayToString(fieldData?.valid);
                          fieldData.invalid = arrayToString(fieldData?.invalid);
                          fieldData.transform = inferTransformOnLoad(fieldData);
                          if (fieldData.email && fieldData.email.tlds && Array.isArray(fieldData.email.tlds.allow)) {
                              fieldData.email.tlds.allow = fieldData.email.tlds.allow.join(", ");
                          }
                          fieldData.isFixedLength =
                              fieldData.length !== undefined && fieldData.length !== null && fieldData.length !== "";
                          if (fieldData.pattern) {
                              fieldData.pattern = {
                                  regex: fieldData.pattern.regex ?? "",
                                  flags: fieldData.pattern.flags ?? "",
                              };
                          }
                          if (!fieldData.validationType) {
                              if (fieldData.email) {
                                  fieldData.validationType = "email";
                              } else if (fieldData.ip || fieldData.IPv4 || fieldData.IPv6) {
                                  fieldData.validationType = "ip";
                              } else if (fieldData.uri) {
                                  fieldData.validationType = "uri";
                              } else if (fieldData.pattern?.regex) {
                                  fieldData.validationType = "pattern";
                              } else {
                                  fieldData.validationType = "-";
                              }
                          }
                      }

                      if (fieldData.ui && typeof fieldData.ui === "object" && !Array.isArray(fieldData.ui)) {
                          const currencyAllowed = fieldData.type === "number";
                          fieldData.ui = {
                              ...fieldData.ui,
                              input_type:
                                  currencyAllowed && fieldData.ui.input_type === "currency" ? "currency" : "text",
                          };
                      }

                      return { name, ...fieldData };
                  })
                : [],
        }),
        [data],
    );

    const handleCloseModal = () => {
        setShowRelatedModal(false);
    };

    return (
        <Formik
            enableReinitialize={true}
            initialValues={formData}
            validationSchema={joiFormikAdapter(AuxSchemaCreateSchema)}
            onSubmit={async (values, { setErrors, setStatus }) => {
                const { fields, ...submissionData } = values;

                submissionData.is_active = submissionData.is_active === 1 || submissionData.is_active === true;

                submissionData.data_structure = fields.reduce((obj, field) => {
                    const { name, validationType, numberSign, sources, ...fieldData } = field;

                    let cleanField = {};

                    switch (field.type) {
                        case "string":
                            cleanField = validateString(validationType, fieldData);
                            break;
                        case "number":
                            cleanField = validateNumber(numberSign, fieldData);
                            break;
                        case "boolean":
                            cleanField = validateBoolean(fieldData);
                            break;
                        case "date":
                            cleanField = validateDate(fieldData);
                            break;
                        default:
                            cleanField = fieldData;
                            break;
                    }

                    if (fieldData.ui && typeof fieldData.ui === "object" && !Array.isArray(fieldData.ui)) {
                        cleanField.ui = {
                            ...fieldData.ui,
                            input_type:
                                field.type === "number" && fieldData.ui.input_type === "currency" ? "currency" : "text",
                        };
                    }

                    try {
                        if (sources && typeof sources === "object") {
                            const cleanedSources = Object.entries(sources).reduce((acc, [key, val]) => {
                                const source = typeof val === "string" ? val.trim() : val;
                                if (typeof source === "string" && source.length > 0) {
                                    acc[key] = source;
                                }
                                return acc;
                            }, {});

                            if (Object.keys(cleanedSources).length > 0) {
                                cleanField.sources = cleanedSources;
                            }
                        }
                    } catch (e) {
                        /*
                         * NOSONAR
                         * If parsing fails, ignore sources to avoid breaking submission
                         */
                    }

                    obj[name] = Object.entries(cleanField).reduce((acc, [key, value]) => {
                        if (value !== null && !(Array.isArray(value) && value.length === 0)) {
                            acc[key] = value;
                        }
                        return acc;
                    }, {});
                    return obj;
                }, {});

                if (hasRelationships && !showRelatedModal) {
                    setShowRelatedModal(true);
                } else {
                    dataHandler(submissionData, setErrors, setStatus);
                }
            }}
        >
            {({ values }) => {
                return (
                    <Form className="flex w-full justify-center" autoComplete="off">
                        <FormCard isId={data?.id} title={t("app.title.auxSchema")} isSending={isSending}>
                            <div className="flex flex-col col-span-3 gap-4">
                                <SectionForm title={t("auxSchema.form.mainDetails")}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <InputCard>
                                            <KField>
                                                <Input
                                                    id="name"
                                                    name="name"
                                                    label={t("auxSchema.form.name")}
                                                    type="text"
                                                    className="flex flex-col items-start justify-start text-start"
                                                />
                                            </KField>
                                        </InputCard>
                                        <InputCard>
                                            <KField>
                                                <SwitchStateAdmin
                                                    name="is_active"
                                                    label={t("auxSchema.form.isActive")}
                                                    tipo="boolean"
                                                />
                                            </KField>
                                        </InputCard>
                                    </div>
                                </SectionForm>
                            </div>
                            <div className="flex flex-col col-span-5 gap-4">
                                <SectionForm
                                    title={t("auxSchema.form.fields")}
                                    isError={!values?.fields?.length}
                                    subTitle={!values?.fields?.length ? t("auxSchema.error.addFields") : ""}
                                >
                                    <DynamicFormFields name="fields" />
                                </SectionForm>
                            </div>
                        </FormCard>
                        <SchemasRelatedConfirmationModal onClose={handleCloseModal} isOpen={showRelatedModal} />
                    </Form>
                );
            }}
        </Formik>
    );
};

AuxSchemasForm.propTypes = {
    dataHandler: PropTypes.func.isRequired,
    data: PropTypes.object,
    isSending: PropTypes.bool,
    hasRelationships: PropTypes.bool,
};

export default AuxSchemasForm;

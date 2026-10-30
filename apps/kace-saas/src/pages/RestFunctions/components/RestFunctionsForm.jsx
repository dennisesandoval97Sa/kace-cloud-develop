import { useEffect, useState } from "react";
import { Formik, Form } from "formik";
import { PropTypes } from "prop-types";
import { useTranslation } from "react-i18next";
import FormCard from "../../../components/core/Cards/FormCard";
import InputCard from "../../../components/core/Cards/InputCard";
import SectionForm from "../../../components/core/Cards/section-form";
import { KField, InputForm as Input } from "@kace/ui-shared";
import { joiFormikAdapter } from "@kace/utils";
import { WSRestFunctionsCreateSchema } from "../../../schemas/WSRestFunctionsSchema";
import { SwitchStateAdmin } from "../../../components/core/switchState/SwitchStateAdmin";
import { SelectForm } from "../../../components/ui-shared/src/components/select-form";
import { getOptionsListFunctions } from "../data/helper.js";
import { WSRestFunctionTypeEnum } from "@/enums/WSRestFunctionTypeEnum";
import { JsonEditor } from "../../../components/ui-shared/src/components/json-editor/JsonEditor";

const RestFunctionsForm = ({ dataHandler, data = {}, isSending = false }) => {
    const { t } = useTranslation();
    const [formValues, setFormValues] = useState(data);
    const optionsList = getOptionsListFunctions(t);

    const typesFunction = WSRestFunctionTypeEnum.toJson();
    const dynamicCapableNumberTypes = [
        typesFunction.INCREMENT,
        typesFunction.DIVIDE,
        typesFunction.SUBTRACT,
        typesFunction.ADD,
        typesFunction.ADD_MINUTES,
        typesFunction.ADD_HOURS,
        typesFunction.ADD_DAYS,
        typesFunction.SUBTRACT_MINUTES,
        typesFunction.SUBTRACT_HOURS,
        typesFunction.SUBTRACT_DAYS,
    ];
    const dateTypes = [
        typesFunction.ADD_MINUTES,
        typesFunction.ADD_HOURS,
        typesFunction.ADD_DAYS,
        typesFunction.SUBTRACT_MINUTES,
        typesFunction.SUBTRACT_HOURS,
        typesFunction.SUBTRACT_DAYS,
    ];
    useEffect(() => {
        if (Object.entries(data).length !== 0) {
            Object.entries(data).forEach(([key, value]) => {
                if (key === "filter_input") {
                    const { filter_input } = data[key];
                    filter_input && (value = filter_input.join(","));
                }
                setFormValues((state) => ({
                    ...state,
                    [key]: value ?? "",
                }));
            });
        }
    }, [data]);

    return (
        <Formik
            enableReinitialize={true}
            initialValues={formValues}
            validationSchema={joiFormikAdapter(WSRestFunctionsCreateSchema)}
            onSubmit={async (values, { setErrors, setStatus }) => {
                let tempFilterInput = "";
                values.is_active = !!values.is_active;

                const isAddToContext = values.type === typesFunction.ADD_TO_CONTEXT;
                const isGenerateUuid = values.type === typesFunction.GENERATE_UUID;

                if (isAddToContext || isGenerateUuid) {
                    values.value_dynamic = false;
                    tempFilterInput = { filter_input: [] };
                } else if (
                    values.type === "formatDate" ||
                    values.type === "convertToTimezone" ||
                    values.type === "regexOr" ||
                    values.type === "concatenateComma" ||
                    values.type === "filterArray" ||
                    values.type === typesFunction.FILTER_ARRAY_ALL ||
                    values.type === typesFunction.FILTER_ARRAY_IN ||
                    values.type === typesFunction.SELECT_ARRAY ||
                    dynamicCapableNumberTypes.includes(values.type)
                ) {
                    values.value_dynamic = !!values.value_dynamic;
                } else {
                    values.value_dynamic = !!values.value_static && values.value_static.toString().trim() !== "";
                }

                if (data?.id) values.id = data.id;

                if (!isAddToContext && !isGenerateUuid && values.filter_input) {
                    if (values.filter_input.includes(",")) {
                        tempFilterInput = {
                            filter_input: values.filter_input.split(","),
                        };
                    } else {
                        tempFilterInput = {
                            filter_input: [values.filter_input],
                        };
                    }
                }

                dataHandler({ ...values, filter_input: tempFilterInput }, setErrors, setStatus);
            }}
        >
            {({ values, setFieldValue }) => (
                <Form className="flex w-full justify-center" autoComplete="off">
                    <FormCard isId={data?.id} title={t("app.title.restFunction")} isSending={isSending}>
                        <div className="flex flex-col col-span-3 gap-8">
                            <SectionForm id="rest_functions_form_info" dataTestId="rest_functions_form_info">
                                <InputCard>
                                    <KField>
                                        <Input
                                            id="description"
                                            name="description"
                                            label={t("restFunctions.form.description")}
                                            type="text"
                                            placeholder={t("restFunctions.placeholder.description")}
                                            className="flex flex-col items-start justify-start text-start"
                                        />
                                    </KField>
                                </InputCard>
                                <InputCard>
                                    <KField>
                                        <SelectForm
                                            id="type"
                                            name="type"
                                            label={t("restFunctions.form.type")}
                                            options={optionsList}
                                            placeholder={t("restFunctions.form.type")}
                                            dataTestId="rest_functions_form_type"
                                        />
                                    </KField>
                                </InputCard>
                                {values.type !== typesFunction.ADD_TO_CONTEXT &&
                                    values.type !== typesFunction.GENERATE_UUID && (
                                        <InputCard>
                                            <KField>
                                                <Input
                                                    id="filter_input"
                                                    name="filter_input"
                                                    label={t("restFunctions.form.filterInput")}
                                                    type="text"
                                                    placeholder={t("restFunctions.placeholder.filterInput")}
                                                    className="flex flex-col items-start justify-start text-start"
                                                />
                                            </KField>
                                        </InputCard>
                                    )}
                                <InputCard>
                                    <KField>
                                        <Input
                                            id="context_position"
                                            name="context_position"
                                            label={t("restFunctions.form.contextPosition")}
                                            type="text"
                                            placeholder={t("restFunctions.placeholder.contextPosition")}
                                            className="flex flex-col items-start justify-start text-start"
                                        />
                                    </KField>
                                </InputCard>
                            </SectionForm>
                        </div>
                        <div className="flex flex-col gap-8 col-start-4 col-span-2">
                            <SectionForm id="rest_functions_form_values" dataTestId="rest_functions_form_values">
                                {(values.type === "formatDate" ||
                                    values.type === "convertToTimezone" ||
                                    values.type === "regexOr" ||
                                    values.type === "concatenateComma" ||
                                    values.type === "filterArray" ||
                                    values.type === typesFunction.FILTER_ARRAY_ALL ||
                                    values.type === typesFunction.SELECT_ARRAY ||
                                    dynamicCapableNumberTypes.includes(values.type)) && (
                                    <InputCard>
                                        <KField>
                                            <SwitchStateAdmin
                                                name="value_dynamic"
                                                tipo="boolean"
                                                className="col-span-3"
                                                title={t("restFunctions.form.valueDynamic")}
                                            />
                                        </KField>
                                    </InputCard>
                                )}
                                <InputCard>
                                    <KField>
                                        {values.type === typesFunction.ADD_TO_CONTEXT ? (
                                            <JsonEditor
                                                value={values.value_static || "{}"}
                                                name="value_static"
                                                setFieldValue={setFieldValue}
                                                label={t("restFunctions.form.values")}
                                            />
                                        ) : (
                                            <Input
                                                id="value_static"
                                                name="value_static"
                                                label={
                                                    values.type === typesFunction.SELECT_ARRAY
                                                        ? t("restFunctions.form.selectArrayValues")
                                                        : t("restFunctions.form.values")
                                                }
                                                type={
                                                    dynamicCapableNumberTypes.includes(values.type) &&
                                                    !values.value_dynamic &&
                                                    !dateTypes.includes(values.type)
                                                        ? "number"
                                                        : "text"
                                                }
                                                placeholder={
                                                    values.type === typesFunction.SELECT_ARRAY
                                                        ? t("restFunctions.placeholder.selectArrayValues")
                                                        : t("restFunctions.placeholder.values")
                                                }
                                                className="flex flex-col items-start justify-start text-start"
                                            />
                                        )}
                                    </KField>
                                    {[
                                        typesFunction.FILTER_ARRAY,
                                        typesFunction.FILTER_ARRAY_ALL,
                                        typesFunction.FILTER_ARRAY_IN,
                                    ].includes(values.type) && (
                                        <div className="text-[11px] text-gray-500 italic text-left w-full pl-1 mt-2">
                                            {t(`restFunctions.help.${values.type}`)}
                                        </div>
                                    )}
                                </InputCard>
                            </SectionForm>
                            <SectionForm id="rest_functions_form_switch" dataTestId="rest_functions_form_switch">
                                <InputCard>
                                    <KField>
                                        <SwitchStateAdmin name="is_active" tipo="boolean" className="col-span-3" />
                                    </KField>
                                </InputCard>
                            </SectionForm>
                        </div>
                    </FormCard>
                </Form>
            )}
        </Formik>
    );
};

RestFunctionsForm.propTypes = {
    dataHandler: PropTypes.func.isRequired,
    data: PropTypes.object,
    isSending: PropTypes.bool,
};

export default RestFunctionsForm;

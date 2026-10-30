import { PropTypes } from "prop-types";
import { Formik, Form } from "formik";
import { useEffect, useState } from "react";
import FormCard from "../../../components/core/Cards/FormCard";
import InputCard from "../../../components/core/Cards/InputCard";
import SectionForm from "../../../components/core/Cards/section-form";
import {
    KField,
    TextAreaForm as Textarea,
    InputForm as Input,
    SelectByProvider,
    JsonTableEditor,
    Button,
} from "@kace/ui-shared";
import { JsonEditor } from "../../../components/ui-shared/src/components/json-editor/JsonEditor";
import { BodyEditor } from "./BodyEditor";
import { useTranslation } from "react-i18next";
import { WS_REST_ENDPOINTS_SERVICE } from "../../../utils/URL";
import { SwitchStateAdmin } from "../../../components/core/switchState/SwitchStateAdmin";
import { WSRestEndpointCreateSchema } from "../../../schemas/WSRestEndpointsSchema";
import { joiFormikAdapter, apiService } from "@kace/utils";
import {
    ERROR_RESPONSE_CODES,
    FILTER_LIST_OPTIONS_AUTHORIZATION,
    METHODS_WS_REST_ENDPOINTS,
    SUCCESS_RESPONSE_CODES,
    TYPES_WS_REST_ENDPOINTS,
} from "../data/constants";
import { prepareDataSee, prepareJsonDataSave } from "../data/helper.js";
import { SelectByUrl } from "../../../components/core/SelectByUrl/SelectByUrl";
import RestEndpointCallback from "./RestEndpointCallback";

const RestEndPointsForm = ({ dataHandler, data = {}, isSending = false }) => {
    const [formData, setFormData] = useState(data);
    const { t } = useTranslation();
    const optionsTypeList = TYPES_WS_REST_ENDPOINTS(t);
    const [showTestModal, setShowTestModal] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [mockRequestData, setMockRequestData] = useState({});

    useEffect(() => {
        if (Object.entries(data).length !== 0) {
            Object.entries(data).forEach(([key, value]) => {
                if (typeof value === "object") {
                    value = prepareDataSee(key, data);
                }

                setFormData((state) => ({
                    ...state,
                    [key]: value ?? "",
                }));
            });
        }
    }, [data]);

    const makeTryout = async (dataId) => {
        try {
            const BASE_URL = import.meta.env.VITE_DEV_BASE_API_URL || "";
            const response = await apiService.get(`${BASE_URL}/ws-rest-endpoints/tryout/${dataId}`);
            return {
                success: response.ok,
                status: response.status,
                data: response,
            };
        } catch (err) {
            return {
                success: false,
                error: err.message,
            };
        }
    };

    return (
        <div>
            <Formik
                enableReinitialize={true}
                initialValues={formData}
                validationSchema={joiFormikAdapter(WSRestEndpointCreateSchema)}
                onSubmit={async (values, { setErrors, setStatus }) => {
                    const NULLABLE_FIELDS = [
                        "authorization_id",
                        "cache_expires_in_path",
                        "cache_default_ttl_seconds",
                        "body_type",
                    ];

                    NULLABLE_FIELDS.forEach((field) => {
                        if (!values[field] || values[field] === "null") {
                            values[field] = null;
                        }
                    });

                    values.is_dynamic_body = +(
                        values.is_dynamic_body === 1 ||
                        values.is_dynamic_body === "1" ||
                        values.is_dynamic_body === true
                    );
                    values.is_dynamic_header = +(
                        values.is_dynamic_header === 1 ||
                        values.is_dynamic_header === "1" ||
                        values.is_dynamic_header === true
                    );

                    if (values.is_active !== 1 && values.is_active !== true) {
                        values.is_active = 0;
                    }

                    if (!values.attempts) {
                        values.attempts = 0;
                    }

                    if (values.cache_default_ttl_seconds) {
                        values.cache_default_ttl_seconds = parseInt(values.cache_default_ttl_seconds, 10);
                    }

                    const tempValues = prepareJsonDataSave(values, t);

                    if (tempValues === undefined) {
                        return;
                    }

                    const filter_input = {
                        filter_input: !values?.filter_input
                            ? []
                            : values.filter_input.includes(",")
                              ? values.filter_input.split(",").map((item) => item.trim())
                              : [values.filter_input.trim()],
                    };

                    const sendValues = {
                        ...values,
                        filter_input,
                        ...tempValues,
                    };

                    dataHandler(sendValues, setErrors, setStatus);
                }}
            >
                {({ values, errors, status, setStatus, setFieldValue, touched }) => {
                    if (Object.entries(errors).length === 0 && status !== undefined) {
                        setStatus(undefined);
                    }

                    return (
                        <Form className="flex w-full justify-center" autoComplete="off">
                            <FormCard
                                isId={data?.id}
                                title={t("app.title.restEndPoint")}
                                isSending={isSending}
                                isTesting={isTesting}
                                showTestButton={true}
                                onTest={async () => {
                                    setIsTesting(true);
                                    const httpResponse = await makeTryout(data?.id);
                                    setMockRequestData(httpResponse);
                                    setShowTestModal(true);
                                    setIsTesting(false);
                                }}
                            >
                                <div className="flex flex-col col-span-3 gap-8">
                                    <SectionForm
                                        tittle={t("Informacion servicio")}
                                        id="rest_endpoints_info"
                                        dataTestId="rest_endpoints_info"
                                    >
                                        <InputCard>
                                            <KField>
                                                <Input
                                                    id="description"
                                                    name="description"
                                                    label={t("restEndPoint.label.description")}
                                                    type="text"
                                                    placeholder={t("restEndPoint.label.description")}
                                                    className="flex flex-col items-start justify-start text-start"
                                                />
                                            </KField>
                                        </InputCard>
                                        <InputCard tittle={t("restEndPoint.label.type")}>
                                            <KField>
                                                <SelectByProvider
                                                    name="type"
                                                    dataOptions={optionsTypeList}
                                                    valueFrom="id"
                                                    labelFrom="label"
                                                    label={t("restEndPoint.label.type")}
                                                    url={null}
                                                />
                                            </KField>
                                        </InputCard>
                                        <InputCard>
                                            <KField>
                                                <Textarea
                                                    name="url"
                                                    label={t("restEndPoint.label.url")}
                                                    placeholder={t("restEndPoint.label.url")}
                                                    className="flex flex-col items-start justify-start text-start"
                                                />
                                            </KField>
                                        </InputCard>
                                        {values.type === "consumption" && (
                                            <InputCard>
                                                <KField>
                                                    <SelectByUrl
                                                        id="authorization_id"
                                                        setFieldValue={setFieldValue}
                                                        value={values.authorization_id}
                                                        name="authorization_id"
                                                        url={`${WS_REST_ENDPOINTS_SERVICE}`}
                                                        keyQuery="authorizationIdList"
                                                        itemLabel="description"
                                                        valueFrom="id"
                                                        label={t("restEndPoint.label.authorization_id")}
                                                        filtro={FILTER_LIST_OPTIONS_AUTHORIZATION}
                                                        error={errors.authorization_id}
                                                        touched={touched.authorization_id}
                                                    />
                                                </KField>
                                            </InputCard>
                                        )}
                                        <InputCard tittle={t("restEndPoint.label.method")}>
                                            <KField>
                                                <SelectByProvider
                                                    name="method"
                                                    dataOptions={METHODS_WS_REST_ENDPOINTS}
                                                    valueFrom="id"
                                                    labelFrom="value"
                                                    staleTime={0}
                                                    label={t("restEndPoint.label.method")}
                                                    url={null}
                                                />
                                            </KField>
                                        </InputCard>
                                        <InputCard>
                                            <KField>
                                                <RestEndpointCallback
                                                    label={t("restEndPoint.onSuccessFlows")}
                                                    name="on_success"
                                                    httpCodes={SUCCESS_RESPONSE_CODES}
                                                />
                                            </KField>
                                        </InputCard>

                                        <InputCard>
                                            <KField>
                                                <RestEndpointCallback
                                                    label={t("restEndPoint.onErrorFlows")}
                                                    name="on_error"
                                                    httpCodes={ERROR_RESPONSE_CODES}
                                                />
                                            </KField>
                                        </InputCard>
                                        <InputCard>
                                            <KField>
                                                <Input
                                                    id="filter_input"
                                                    name="filter_input"
                                                    label={t("restEndPoint.label.filter_input")}
                                                    type="text"
                                                    placeholder={t("restEndPoint.label.filter_input")}
                                                    className="flex flex-col items-start justify-start text-start"
                                                />
                                            </KField>
                                        </InputCard>
                                        <InputCard>
                                            <KField>
                                                <Input
                                                    id="context_position"
                                                    name="context_position"
                                                    label={t("restEndPoint.label.context_position")}
                                                    type="text"
                                                    placeholder={t("restEndPoint.label.context_position")}
                                                    className="flex flex-col items-start justify-start text-start"
                                                />
                                            </KField>
                                        </InputCard>
                                        <InputCard>
                                            <KField>
                                                <Input
                                                    id="attempts"
                                                    name="attempts"
                                                    label={t("restEndPoint.label.attempts")}
                                                    type="number"
                                                    placeholder={t("restEndPoint.label.attempts")}
                                                    className="flex flex-col items-start justify-start text-start"
                                                />
                                            </KField>
                                        </InputCard>
                                        {values.type === "authorization" && (
                                            <>
                                                <InputCard>
                                                    <KField>
                                                        <Input
                                                            id="cache_expires_in_path"
                                                            name="cache_expires_in_path"
                                                            label={t("restEndPoint.label.cache_expires_in_path")}
                                                            type="text"
                                                            placeholder="expires_in"
                                                            className="flex flex-col items-start justify-start text-start"
                                                        />
                                                    </KField>
                                                </InputCard>
                                                <InputCard>
                                                    <KField>
                                                        <Input
                                                            id="cache_default_ttl_seconds"
                                                            name="cache_default_ttl_seconds"
                                                            label={t("restEndPoint.label.cache_default_ttl_seconds")}
                                                            type="number"
                                                            placeholder="3600"
                                                            className="flex flex-col items-start justify-start text-start"
                                                        />
                                                    </KField>
                                                </InputCard>
                                            </>
                                        )}
                                    </SectionForm>
                                </div>
                                <div className="flex flex-col gap-8 col-start-4 col-span-2">
                                    <SectionForm>
                                        <InputCard>
                                            <KField>
                                                <SwitchStateAdmin
                                                    name="is_active"
                                                    tipo="boolean"
                                                    className="col-span-3"
                                                />
                                            </KField>
                                        </InputCard>
                                        <SwitchStateAdmin
                                            id="is_dynamic_header"
                                            title={t("restEndPoint.label.is_dynamic_header")}
                                            tipo="boolean"
                                            name="is_dynamic_header"
                                            className="col-span-3"
                                        />
                                        <InputCard>
                                            <KField>
                                                <JsonTableEditor
                                                    name="headers"
                                                    label={t("restEndPoint.label.headers")}
                                                    value={values.headers}
                                                    setFieldValue={setFieldValue}
                                                />
                                            </KField>
                                        </InputCard>
                                        <SwitchStateAdmin
                                            title={t("restEndPoint.label.is_dynamic_body")}
                                            tipo="boolean"
                                            name="is_dynamic_body"
                                            className="col-span-3"
                                        />

                                        <InputCard>
                                            <KField>
                                                <BodyEditor
                                                    bodyValue={values?.body}
                                                    bodyType={values?.body_type ?? "json"}
                                                    setFieldValue={setFieldValue}
                                                    label={t("restEndPoint.label.body")}
                                                />
                                            </KField>
                                        </InputCard>

                                        <InputCard>
                                            <KField>
                                                <JsonEditor
                                                    name="initial_context"
                                                    label={t("restEndPoint.label.initialContext")}
                                                    value={values?.initial_context}
                                                    setFieldValue={setFieldValue}
                                                />
                                            </KField>
                                        </InputCard>
                                    </SectionForm>
                                </div>
                            </FormCard>
                        </Form>
                    );
                }}
            </Formik>
            {showTestModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded shadow-xl max-w-2xl w-full relative">
                        <button
                            onClick={() => setShowTestModal(false)}
                            className="absolute top-3 right-3 text-gray-500 hover:text-black"
                        >
                            ✕
                        </button>
                        <h2 className="text-xl font-bold mb-4">{t("restEndPoint.requestPreview")}</h2>

                        <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-80">
                            {JSON.stringify(mockRequestData, null, 2)}
                        </pre>

                        <div className="flex justify-end mt-4">
                            <Button onClick={() => setShowTestModal(false)}>{t("app.forms.close")}</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

RestEndPointsForm.propTypes = {
    dataHandler: PropTypes.func.isRequired,
    data: PropTypes.object,
    isSending: PropTypes.bool,
};
export default RestEndPointsForm;

import React from "react";
import { PropTypes } from "prop-types";
import { useFormikContext } from "formik";
import { useTranslation } from "react-i18next";

import { Button } from "@kace/ui-shared";
import SelectField from "@kace_v2/shared/ui/molecules/SelectField";
import SelectFromQuery from "@/componentsV2/lib/SelectFromQuery";
import useRestEndpointCallbackData from "../hooks/useRestEndpointCallbackData";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

const RestEndpointCallback = ({ label, name, httpCodes }) => {
    const { t } = useTranslation();

    const { values, setFieldValue } = useFormikContext();
    const {
        selectedCode,
        selectedFlow,
        selectedResponses,
        setSelectedCode,
        setSelectedFlow,
        getOptionLabel,
        handleRemoveFlow,
        handleResponseSelect,
    } = useRestEndpointCallbackData(name, values, setFieldValue);

    return (
        <div>
            <h2
                className="text-xl font-bold"
                id="rest_endpoint_callback_title"
                data-testid="rest_endpoint_callback_title"
            >
                {label}
            </h2>

            <div className="flex-col gap-6">
                <div className="my-4 space-y-4">
                    <div className="flex gap-4 items-start">
                        <div
                            className="flex-1"
                            id={`rest_endpoint_callback_inpt_${selectedCode}`}
                            data-testid={`select_code_rest_endpoint_callback_${selectedCode}`}
                        >
                            <SelectField
                                placeholder={t("restEndPoint.selectResponse")}
                                options={httpCodes.map((code) => ({
                                    value: String(code.code),
                                    label: `${code.code} - ${code.description}`,
                                }))}
                                value={selectedCode}
                                onValueChange={setSelectedCode}
                            />
                        </div>
                        <div
                            className="flex-1"
                            id={`rest_endpoint_callback_inpt_${selectedFlow}`}
                            data-testid={`rest_endpoint_callback_inpt_${selectedFlow}`}
                        >
                            <SelectFromQuery
                                name={`${name}_flow_picker`}
                                value={selectedFlow}
                                setFieldValue={(_, newValue) => setSelectedFlow(newValue ?? "")}
                                url={`${URL_AND_KEYS.restFlows.url}/search`}
                                labelField="description"
                                queryKey={[URL_AND_KEYS.restFlows.key, "endpoint-callback", name]}
                                filter={[
                                    {
                                        field: `${URL_AND_KEYS.restFlows.view}.is_primary`,
                                        operator: "eq",
                                        value: "true",
                                        type: "AND",
                                    },
                                ]}
                                placeholder={t("restEndPoint.selectFlow")}
                            />
                        </div>
                        <Button
                            type="button"
                            onClick={handleResponseSelect}
                            id="btn_add_rest_code_flow"
                            data-testid="btn_add_rest_code_flow"
                        >
                            +
                        </Button>
                    </div>

                    {Object.keys(selectedResponses).map((code, index) => (
                        <li
                            className="flex gap-4 items-center"
                            key={`selected_flow_${index}`}
                            id={`selected_flow_${index}`}
                        >
                            <span id={`span_rest_endpoint_${code}`} data-testid={`span_rest_endpoint_${code}`}>
                                {code}
                            </span>
                            <span> &gt; </span>
                            <span
                                id={`span_selected_response_${getOptionLabel(selectedResponses[code])}`}
                                data-testid={`span_selected_response_${getOptionLabel(selectedResponses[code])}`}
                            >
                                {getOptionLabel(selectedResponses[code])}
                            </span>
                            <Button
                                type="button"
                                onClick={() => handleRemoveFlow(code)}
                                id="btn_clean_rest_code_flow"
                                data-testid="btn_clean_rest_code_flow"
                            >
                                X
                            </Button>
                        </li>
                    ))}
                </div>
            </div>
        </div>
    );
};

RestEndpointCallback.propTypes = {
    label: PropTypes.string,
    name: PropTypes.string,
    httpCodes: PropTypes.array,
};

export default RestEndpointCallback;

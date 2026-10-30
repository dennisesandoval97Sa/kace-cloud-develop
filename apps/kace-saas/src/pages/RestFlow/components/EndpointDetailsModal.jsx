import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@kace/ui-shared";
import { useTranslation } from "react-i18next";
import { PropTypes } from "prop-types";
import EndpointDetailsModalFlows from "./EndpointDetailsModalFlows";
import { formatTestId } from "@/utils/src/helpers";
import { useNavigate } from "react-router-dom";
import { REST_FLOWS_TYPES } from "../data/constants";
import { Button } from "@/components/ui-shared";

const EndpointDetailsModal = ({ open, onOpenChange, data }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const flowType = data?.typeFlow ?? REST_FLOWS_TYPES.endpoint;
    const isEndpoint = flowType === REST_FLOWS_TYPES.endpoint;
    const url = `/${isEndpoint ? "rest-endpoints" : "rest-functions"}/update/${data?.id}`;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[625px] max-h-[550px] overflow-auto">
                <DialogHeader>
                    <DialogTitle id="endpoint_details_modal_title" data-testid="endpoint_details_modal_title">
                        {isEndpoint ? t("restFlow.endpointInformation") : t("restFlow.functionInformation")}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex flex-col justify-stretch gap-2">
                    <span
                        className="font-bold"
                        id="endpoint_details_modal_descriptions"
                        data-testid="endpoint_details_modal_descriptions"
                    >
                        {t("restEndPoint.label.description")}
                    </span>
                    <div
                        className="flex"
                        id={formatTestId("endpoint_details_descriptions", `${data?.description}`)}
                        data-testid={formatTestId("endpoint_details_descriptions", `${data?.description}`)}
                    >
                        {data?.description}
                    </div>

                    {isEndpoint ? (
                        <div className="flex gap-4">
                            <EndpointDetailsModalFlows
                                key="successful"
                                title={t("restEndPoint.relatedSuccessfulFlows")}
                                data={{ flows: data?.on_success?.on_success }}
                            />

                            <EndpointDetailsModalFlows
                                key="unsuccessful"
                                title={t("restEndPoint.relatedUnsuccessfulFlows")}
                                data={{ flows: data?.on_error?.on_error }}
                            />
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2 border rounded-md p-2 bg-gray-50">
                            <div>
                                <span className="font-bold">{t("gridMain.columns.Type")}</span>
                                <div>{data?.type}</div>
                            </div>
                            <div>
                                <div className="font-bold">{t("restEndPoint.label.filter_input")}</div>
                                <div>{data?.filter_input?.filter_input?.join(", ") || "—"}</div>
                            </div>
                            <div>
                                <div className="font-bold">{t("gridMain.columns.Static Value")}</div>
                                <div>{data?.value_static || "—"}</div>
                            </div>
                            <div>
                                <div className="font-bold">{t("restEndPoint.label.context_position")}</div>
                                <div>{data?.context_position || "—"}</div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="mt-2">
                    <Button type="button" onClick={() => navigate(url)}>
                        {t("restFlow.viewDetail")}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

EndpointDetailsModal.propTypes = {
    open: PropTypes.bool,
    onOpenChange: PropTypes.func,
    data: PropTypes.object.isRequired,
};

export default EndpointDetailsModal;

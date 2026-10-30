import { Formik, Form } from "formik";
import { PropTypes } from "prop-types";
import { useRef, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { InputFormModal as Input, KField, TextAreaForm as Textarea, Button } from "@kace/ui-shared";
import { FlowDiagram } from "@/components/ui-shared/src/components/flowDiagram/FlowDiagram";
import { joiFormikAdapter, NAME_LOCATION_FILTER } from "@kace/utils";
import { WS_REST_ENDPOINTS_SERVICE, WS_REST_FUNCTIONS_SERVICE } from "@kace/urls";
import useGenericSearchQuery from "@kace/hooks/useGenericSearchQuery";
import useIsSeeMode from "@/hooks/useIsSeeMode";
import { INITIAL_NODE, REST_FLOWS_TYPES } from "../data/constants";
import { SwitchStateAdmin } from "../../../components/core/switchState/SwitchStateAdmin";
import { WSRestFlowCreateSchema } from "../../../schemas/WSRestFlowsSchema";
import EndpointDetailsModal from "./EndpointDetailsModal";
import FormCard from "../../../components/core/Cards/FormCard";
import InputCard from "../../../components/core/Cards/InputCard";
import NodeSelect from "./NodeSelect";
import SectionForm from "../../../components/core/Cards/section-form";
import { filterEndpoinds } from "../data/queries";
import ConditionalNodeModal from "./ConditionalNodeModal";

const RestFlowsForm = ({ dataHandler, data = {}, isSending = false }) => {
    const formikRef = useRef();
    const [nodes, setNodes] = useState([INITIAL_NODE]);
    const [edges, setEdges] = useState([]);
    const [availableFunctions, setAvailableFunctions] = useState([]);
    const [availableEndpoints, setAvailableEndpoints] = useState([]);
    const [formData, setFormData] = useState(data);
    const [selectedEndpoint, setSelectedEndpoint] = useState(null);
    const [isFlowClean, setIsFlowClean] = useState(false);
    const [showConditionalModal, setShowConditionalModal] = useState(false);
    const { t } = useTranslation();
    const isSeeMode = useIsSeeMode();

    useEffect(() => {
        if (Object.entries(data).length !== 0) {
            Object.entries(data).forEach(([key, value]) => {
                setFormData((state) => ({
                    ...state,
                    [key]: value ?? "",
                }));
            });
        }

        if (!!data?.json_diagram_properties?.edges && !!data?.json_diagram_properties?.nodes) {
            setEdges(data?.json_diagram_properties.edges);
            setNodes(data?.json_diagram_properties.nodes);
        }

        handleDeselectNodes();
    }, [data]);

    const addNode = (node) => {
        const styledNode = {
            ...node,
            style: {
                ...(node.style || {}),
                wordBreak: "break-word",
            },
        };

        setNodes((prevState) => [...prevState, styledNode]);
    };

    const getNextY = () => {
        let lowest = 100;

        nodes.forEach((node) => {
            lowest = Math.max(lowest, node.position.y);
        });

        return lowest + 100;
    };

    const { data: functionsData } = useGenericSearchQuery({
        keyQuery: "wsRestFunctionsData",
        url: `${WS_REST_FUNCTIONS_SERVICE}/search`,
        select: (data) => data.data,
        table: NAME_LOCATION_FILTER.WS_REST_FUNCTIONS.schemaFields,
        filter: [],
    });

    const { data: endpointsData } = useGenericSearchQuery({
        keyQuery: "wsRestEndpointsData",
        url: `${WS_REST_ENDPOINTS_SERVICE}/search`,
        select: (data) => data.data,
        table: NAME_LOCATION_FILTER.WS_REST_ENDPOINTS.schemaFields,
        filter: filterEndpoinds(),
    });

    useEffect(() => {
        if (functionsData) {
            setAvailableFunctions(functionsData);
        }
    }, [functionsData]);

    useEffect(() => {
        if (endpointsData) {
            setAvailableEndpoints(endpointsData);
        }
    }, [endpointsData]);

    const handleNodeSelected = (node) => {
        const selectedNode = nodes.find((nd) => node.id === nd.id);
        let selectedEndpoint = null;
        let typeFlow = REST_FLOWS_TYPES.endpoint;
        if (selectedNode.data.type === REST_FLOWS_TYPES.endpoint) {
            selectedEndpoint = availableEndpoints.find((ep) => ep.id === selectedNode.data.id);
        } else {
            selectedEndpoint = availableFunctions.find((ep) => ep.id === selectedNode.data.id);
            typeFlow = REST_FLOWS_TYPES.function;
        }

        if (!selectedEndpoint) return;
        setSelectedEndpoint({ ...selectedEndpoint, typeFlow });
    };

    const handleDeselectNodes = () => {
        setSelectedEndpoint(null);
        setNodes((prevState) =>
            prevState.map((node) => ({
                ...node,
                selected: false,
            })),
        );
    };

    const getPath = () => {
        const outgoing = edges.reduce((map, edge) => {
            if (!map[edge.source]) map[edge.source] = [];
            map[edge.source].push(edge.target);
            return map;
        }, {});

        const path = [];
        const visited = new Set();

        const traverse = (nodeId) => {
            if (!nodeId || visited.has(nodeId) || nodeId === "0") return;
            const node = nodes.find((n) => n.id === nodeId);
            if (!node) return;
            visited.add(nodeId);
            path.push({
                id: nodeId,
                flow_id: data.id,
                order: path.length + 1,
                ...(node.data.type === "function" ? { function_id: node.data.id } : { endpoint_id: node.data.id }),
            });

            const targets = outgoing[nodeId] || [];
            targets.forEach(traverse);
        };

        const firstTargets = outgoing["0"] || [];
        firstTargets.forEach(traverse);
        return path;
    };

    const cleanFlow = () => {
        const path = getPath();
        setNodes((nds) => nds.filter((node) => node.id === "0" || path.find((step) => step.id === node.id)));

        setIsFlowClean(true);
    };

    useEffect(() => {
        if (isFlowClean) {
            setIsFlowClean(false);
        }
    }, [nodes, edges]);

    useEffect(() => {
        if (isFlowClean) {
            formikRef.current.submitForm();
        }
    }, [isFlowClean]);

    return (
        <>
            <EndpointDetailsModal
                open={!!selectedEndpoint}
                onOpenChange={handleDeselectNodes}
                data={selectedEndpoint}
            />
            {showConditionalModal && (
                <ConditionalNodeModal
                    onClose={() => setShowConditionalModal(false)}
                    onCreate={addNode}
                    nextY={getNextY()}
                />
            )}
            <Formik
                innerRef={formikRef}
                enableReinitialize={true}
                initialValues={formData}
                validationSchema={joiFormikAdapter(WSRestFlowCreateSchema)}
                onSubmit={async (values, { setErrors, setStatus }) => {
                    if (isSeeMode) return;
                    if (isFlowClean) {
                        values.is_active = !!values.is_active;
                        dataHandler(getPath(), values, setErrors, setStatus);
                    } else {
                        cleanFlow();
                    }
                }}
            >
                <Form
                    className="flex w-full justify-center"
                    autoComplete="off"
                    {...(isSeeMode && { onSubmit: (event) => event.preventDefault() })}
                >
                    <FormCard
                        isId={data?.id}
                        title={t("restFlow.serviceFlow")}
                        isSending={isSending}
                        lockChildrenInSeeMode={false}
                    >
                        <div className="flex col-span-12 flex-col gap-8">
                            <SectionForm tittle={t("restFlow.serviceFlow")}>
                                <fieldset
                                    disabled={isSeeMode}
                                    className="contents"
                                    data-testid="restflow_form_information_fields"
                                >
                                    <InputCard className="flex flex-1">
                                        <KField>
                                            <Textarea
                                                name="description"
                                                label={t("app.forms.description")}
                                                placeholder={t("app.forms.description")}
                                                className="flex flex-col items-start justify-start text-start"
                                            />
                                        </KField>
                                    </InputCard>

                                    <InputCard className="flex flex-1">
                                        <KField>
                                            <Input
                                                type="text"
                                                name="external_code"
                                                label={t("restFlow.externalCode")}
                                                placeholder={t("restFlow.externalCode")}
                                                className="flex flex-col items-start justify-start text-start w-full gap-1.5"
                                                labelClassName="font-medium leading-none"
                                            />
                                        </KField>
                                    </InputCard>

                                    <InputCard>
                                        <KField>
                                            <SwitchStateAdmin name="is_active" tipo="boolean" className="col-span-3" />
                                        </KField>
                                    </InputCard>
                                </fieldset>
                            </SectionForm>
                            <SectionForm id="restflow_service" dataTestId="restflow_services">
                                <div className="col-span-12 h-screen mx-1 border rounded-md my-2 border-brand flex flex-col relative">
                                    <fieldset
                                        disabled={isSeeMode}
                                        className="col-span-12 flex py-2 sticky top-0 w-full z-10 bg-white/95 shadow-md min-w-0"
                                        data-testid="restflow_form_node_toolbar"
                                    >
                                        <div className="flex flex-1 justify-center [&_button]:!bg-[rgb(232,196,104)] [&_button]:!text-black [&_button]:!border [&_button]:!border-[rgb(232,196,104)]">
                                            <NodeSelect
                                                label={t("restFlow.endpoints")}
                                                nextY={getNextY()}
                                                onSelect={addNode}
                                                type="endpoint"
                                                useInfinite={true}
                                                url={`${WS_REST_ENDPOINTS_SERVICE}/search`}
                                                filterFn={filterEndpoinds}
                                                tableName={NAME_LOCATION_FILTER.WS_REST_ENDPOINTS.schemaFields}
                                            />
                                        </div>
                                        <div className="flex flex-1 justify-center">
                                            <Button
                                                type="button"
                                                onClick={() => setShowConditionalModal(true)}
                                                className="!bg-[rgb(217,242,221)] !text-[rgb(88,159,103)] !border !border-[rgb(88,159,103)] hover:!bg-[rgb(217,242,221)]/80"
                                            >
                                                {t("restFlow.newConditional")}
                                            </Button>
                                        </div>
                                        <div className="flex flex-1 justify-center [&_button]:!bg-[rgb(231,110,80)] [&_button]:!text-white [&_button]:!border [&_button]:!border-[rgb(231,110,80)]">
                                            <NodeSelect
                                                label={t("restFlow.functions")}
                                                nextY={getNextY()}
                                                onSelect={addNode}
                                                type="function"
                                                useInfinite={true}
                                                url={`${WS_REST_FUNCTIONS_SERVICE}/search`}
                                                filterFn={() => []}
                                                tableName={NAME_LOCATION_FILTER.WS_REST_FUNCTIONS.schemaFields}
                                            />
                                        </div>
                                    </fieldset>
                                    <div className="flex-1 overflow-hidden" style={{ width: "100%" }}>
                                        <FlowDiagram
                                            availableNodes={[...availableFunctions, ...availableEndpoints]}
                                            initialNodes={nodes}
                                            initialEdges={edges}
                                            forceSequential={true}
                                            onNodeSelected={handleNodeSelected}
                                            externalUpdateNodes={setNodes}
                                            externalUpdateEdges={setEdges}
                                            isControlled={true}
                                            fieldName="json_diagram_properties"
                                            zoomOnScroll={false}
                                            allowRootFunction={true}
                                            edgeControlClassName="!top-16"
                                            showEdgeSelectHint={false}
                                            readOnly={isSeeMode}
                                        />
                                    </div>
                                </div>
                            </SectionForm>
                        </div>
                    </FormCard>
                </Form>
            </Formik>
        </>
    );
};

RestFlowsForm.propTypes = {
    dataHandler: PropTypes.func.isRequired,
    data: PropTypes.object,
    isSending: PropTypes.bool,
};

export default RestFlowsForm;

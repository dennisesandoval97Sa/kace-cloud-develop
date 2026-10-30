import { InputForm as Input, KField } from "@kace/ui-shared";
import { FlowDiagram } from "@/components/ui-shared/src/components/flowDiagram/FlowDiagram";
import useIsSeeMode from "@/hooks/useIsSeeMode";
import { joiFormikAdapter } from "@kace/utils";
import { Form, Formik } from "formik";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import FormCard from "../../../components/core/Cards/FormCard";
import InputCard from "../../../components/core/Cards/InputCard";
import SectionForm from "../../../components/core/Cards/section-form";
import { SwitchStateAdmin } from "../../../components/core/switchState/SwitchStateAdmin";
import { FlowCreateSchemaForm } from "../../../schemas/FlowSchema";
import useFlowActions from "../hooks/useFlowActions";
import { Sidebar } from "./Sidebar";

export const FlowsForm = () => {
    const { handleFlow, flow, nodes, edges, ansList, rulesList, availableNodes, isUpdatePending, setNodes, setEdges } =
        useFlowActions();

    const [flowData, setFlowData] = useState(flow);
    const [searchTerm, setSearchTerm] = useState("");
    const [filteredNodes, setFilteredNodes] = useState(availableNodes);
    const { t } = useTranslation();
    const isSeeMode = useIsSeeMode();

    useEffect(() => {
        setFilteredNodes(availableNodes.filter((node) => node.nombre.toLowerCase().includes(searchTerm.toLowerCase())));
    }, [searchTerm, availableNodes]);

    useEffect(() => {
        if (Object.entries(flow).length !== 0) {
            Object.entries(flow).forEach(([key, value]) => {
                setFlowData((state) => ({
                    ...state,
                    [key]: value || "",
                }));
            });
        }
    }, [flow]);

    return (
        <Formik
            enableReinitialize={true}
            initialValues={flowData}
            validationSchema={joiFormikAdapter(FlowCreateSchemaForm)}
            onSubmit={(values, { setErrors, setStatus }) => {
                if (isSeeMode) return;
                handleFlow(values, setErrors, setStatus);
            }}
        >
            <Form
                className="flex w-full justify-center h-full"
                autoComplete="off"
                {...(isSeeMode && { onSubmit: (event) => event.preventDefault() })}
            >
                <FormCard
                    isId={flow?.id}
                    isSending={isUpdatePending}
                    title={t("app.title.flows")}
                    lockChildrenInSeeMode={false}
                >
                    <div className="flex flex-col col-span-5 gap-8 h-full">
                        <SectionForm title={t("flow.title.information")}>
                            <fieldset
                                disabled={isSeeMode}
                                className="flex flex-col md:flex-row gap-4 min-w-0"
                                data-testid="flows_form_information_fields"
                            >
                                <InputCard className="md:w-1/3 w-full">
                                    <KField>
                                        <Input
                                            type="text"
                                            name="nombre"
                                            label={t("flow.form.nombre")}
                                            placeholder={t("flow.form.nombre")}
                                            className="flex flex-col items-start justify-start text-start"
                                            datat-testid="flows_form_input_name"
                                        />
                                    </KField>
                                </InputCard>
                                <InputCard className="md:w-1/3 w-full">
                                    <KField>
                                        <Input
                                            type="text"
                                            name="searchNodes"
                                            label={t("flow.form.searchNodes")}
                                            placeholder={t("flow.form.searchNodes")}
                                            className="flex flex-col items-start justify-start text-start"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            datat-testid="flows_form_input_searchnodes"
                                        />
                                    </KField>
                                </InputCard>
                                {flow.id && (
                                    <InputCard className="md:w-1/3 w-full flex items-end">
                                        <KField>
                                            <SwitchStateAdmin name="status" />
                                        </KField>
                                    </InputCard>
                                )}
                            </fieldset>
                            <div className="col-span-12 h-screen mx-1 border rounded-md my-2 border-brand flex">
                                {searchTerm && <Sidebar availableNodes={filteredNodes} className="col-span-4 h-full" />}
                                <div style={{ width: "100%", height: "95%" }}>
                                    <FlowDiagram
                                        availableNodes={availableNodes}
                                        initialNodes={nodes}
                                        initialEdges={edges}
                                        externalUpdateNodes={setNodes}
                                        externalUpdateEdges={setEdges}
                                        enableAnsSelection={true}
                                        ansList={ansList}
                                        enableRuleSelection={true}
                                        rulesList={rulesList}
                                        readOnly={isSeeMode}
                                    />
                                </div>
                                <KField>
                                    <Input type="hidden" name="json_flujo" data-testid="flows_form_json" />
                                </KField>
                            </div>
                        </SectionForm>
                    </div>
                </FormCard>
            </Form>
        </Formik>
    );
};

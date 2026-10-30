import PropTypes from "prop-types";
import { Formik, Form } from "formik";
import { useRef, useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FlowDiagram } from "@/components/ui-shared/src/components/flowDiagram/FlowDiagram";
import { joiFormikAdapter } from "@kace/utils";
import SectionForm from "@/components/core/Cards/section-form";
import FormCard from "@/components/core/Cards/FormCard";
import useIsSeeMode from "@/hooks/useIsSeeMode";
import { ClassificationFlowSchema } from "@/schemas/ClassificationFlowSchema";
import ClassificationSelect from "./ClassificationSelect";
import { BLANK_EDGES, BLANK_NODES } from "../../data/constants";

const CreateClassificationFlowForm = ({ dataHandler, data = {}, isSending = false }) => {
    const formikRef = useRef();
    const [nodes, setNodes] = useState(BLANK_NODES);
    const [edges, setEdges] = useState(BLANK_EDGES);

    const { t } = useTranslation();
    const isSeeMode = useIsSeeMode();
    const [showDiagram, setShowDiagram] = useState(false);
    const lastDataSignatureRef = useRef();
    const diagramInitializedRef = useRef(false);

    const nodeStyleForType = useCallback((type) => {
        switch (type) {
            case "primary":
                return { backgroundColor: "rgb(80, 110, 231)", color: "white" };
            case "subclassification":
                return { backgroundColor: "rgb(104, 232, 196)", color: "black" };
            default:
                return { backgroundColor: "rgb(200, 200, 200)", color: "black" };
        }
    }, []);

    const nodesEqual = useCallback((a = [], b = []) => {
        if (a === b) return true;
        if (!Array.isArray(a) || !Array.isArray(b)) return false;
        if (a.length !== b.length) return false;
        const mapB = new Map(b.map((n) => [n.id, n]));
        for (const na of a) {
            const nb = mapB.get(na.id);
            if (!nb) return false;
            const pa = na.position || {};
            const pb = nb.position || {};
            if (pa.x !== pb.x || pa.y !== pb.y) return false;
        }
        return true;
    }, []);

    const edgesEqual = useCallback((a = [], b = []) => {
        if (a === b) return true;
        if (!Array.isArray(a) || !Array.isArray(b)) return false;
        if (a.length !== b.length) return false;
        const key = (e) => `${e?.id || ""}|${e?.source}|${e?.target}`;
        const sa = a.map(key).sort();
        const sb = b.map(key).sort();
        for (let i = 0; i < sa.length; i++) {
            if (sa[i] !== sb[i]) return false;
        }
        return true;
    }, []);

    useEffect(() => {
        const signature = `${data?.id || ""}:${data?.json_flujo?.nodes?.length || 0}:${data?.json_flujo?.edges?.length || 0}`;
        if (signature === (lastDataSignatureRef.current || "")) return;
        lastDataSignatureRef.current = signature;

        const BLANK_NODES_LOCAL = BLANK_NODES.map((node) => ({
            ...node,
            ...(data?.id && (node.id === "primary-node" || node.id === data?.id)
                ? {
                      id: data.id,
                      data: {
                          ...node.data,
                          label: data.description,
                      },
                  }
                : {}),
        }));

        const BLANK_EDGES_LOCAL = BLANK_EDGES.map((edge) => ({
            ...edge,
            ...(data?.id && edge.target === "primary-node" ? { target: data.id } : {}),
        }));

        if (data?.json_flujo) {
            const rawNodes = data.json_flujo.nodes || BLANK_NODES_LOCAL;
            const normalized = rawNodes.map((n) => ({
                ...n,
                style: {
                    ...nodeStyleForType(n?.data?.type),
                    ...(n.style || {}),
                    wordBreak: (n.style && n.style.wordBreak) || "break-word",
                },
            }));
            if (!nodesEqual(nodes, normalized)) setNodes(normalized);
            const incomingEdges = data.json_flujo.edges?.length ? data.json_flujo.edges : BLANK_EDGES_LOCAL;
            if (!edgesEqual(edges, incomingEdges)) setEdges(incomingEdges);
            if (!diagramInitializedRef.current) {
                diagramInitializedRef.current = true;
                requestAnimationFrame(() => setShowDiagram(true));
            }
        } else {
            if (!nodesEqual(nodes, BLANK_NODES_LOCAL)) setNodes(BLANK_NODES_LOCAL);
            if (!edgesEqual(edges, BLANK_EDGES_LOCAL)) setEdges(BLANK_EDGES_LOCAL);
        }
    }, [data, nodeStyleForType]);

    const addNode = useCallback((node) => {
        setNodes((prev) => [...prev, { ...node, style: { ...(node.style || {}), wordBreak: "break-word" } }]);
    }, []);

    const getNextY = useCallback(() => {
        if (nodes.length === 0) return 100;
        return nodes.reduce((maxY, node) => Math.max(maxY, node.position.y), 0) + 100;
    }, [nodes]);

    const getPath = useCallback(() => {
        const adjList = edges.reduce((acc, edge) => {
            if (!acc[edge.source]) acc[edge.source] = [];
            if (!acc[edge.target]) acc[edge.target] = [];
            acc[edge.source].push(edge.target);
            acc[edge.target].push(edge.source);
            return acc;
        }, {});

        const path = [];
        const startNodes = adjList["0"] || [];
        if (startNodes.length === 0) return [];

        const queue = [...startNodes];
        const visited = new Set(["0", ...startNodes]);

        while (queue.length > 0) {
            const currentNodeId = queue.shift();
            const nodeInfo = nodes.find((n) => n.id === currentNodeId);
            if (!nodeInfo) continue;

            path.push({
                id: nodeInfo.id,
                flow_id: data.id,
                order: path.length + 1,
                ...(nodeInfo.data.type === "primary"
                    ? { classification_id: nodeInfo.data.id }
                    : { subclassification_id: nodeInfo.data.id }),
            });

            const children = adjList[currentNodeId] || [];
            for (const childId of children) {
                if (!visited.has(childId)) {
                    visited.add(childId);
                    queue.push(childId);
                }
            }
        }

        return path;
    }, [edges, nodes, data.id]);

    useEffect(() => {
        if (formikRef && formikRef.current && typeof formikRef.current.setFieldValue === "function") {
            formikRef.current.setFieldValue("json_flujo", { nodes, edges });
        }
    }, [nodes, edges]);

    const cleanFlow = useCallback(() => {
        const adj = edges.reduce((acc, e) => {
            if (!acc[e.source]) acc[e.source] = [];
            if (!acc[e.target]) acc[e.target] = [];
            acc[e.source].push(e.target);
            acc[e.target].push(e.source);
            return acc;
        }, {});

        const startEdges = edges.filter((e) => e.source === "0");
        let startPrimaryId = null;
        for (const se of startEdges) {
            const n = nodes.find((nn) => nn.id === se.target);
            if (n && n.data && n.data.type === "primary") {
                startPrimaryId = se.target;
                break;
            }
        }

        if (!startPrimaryId) {
            const path = getPath();
            const firstPrimary = path.find((p) => p.classification_id);
            if (firstPrimary) startPrimaryId = firstPrimary.id;
        }

        if (!startPrimaryId) {
            const emptyNodes = BLANK_NODES;
            const emptyEdges = BLANK_EDGES;
            setNodes(emptyNodes);
            setEdges(emptyEdges);
            return { nodes: emptyNodes, edges: emptyEdges, path: [] };
        }

        const visited = new Set([startPrimaryId, "0"]);
        const queue = [startPrimaryId];
        const keptNodeIds = new Set([startPrimaryId, "0"]);

        while (queue.length) {
            const cur = queue.shift();
            const neighbors = adj[cur] || [];
            for (const nbId of neighbors) {
                if (visited.has(nbId)) continue;
                const nbNode = nodes.find((n) => n.id === nbId);
                if (!nbNode) continue;
                if (nbNode.data && nbNode.data.type === "primary") {
                    visited.add(nbId);
                    continue;
                }
                visited.add(nbId);
                keptNodeIds.add(nbId);
                queue.push(nbId);
            }
        }

        const newNodes = nodes.filter((n) => keptNodeIds.has(n.id));
        const newEdges = edges.filter((e) => keptNodeIds.has(e.source) && keptNodeIds.has(e.target));
        const path = [];
        const q2 = [startPrimaryId];
        const seen2 = new Set([startPrimaryId]);
        while (q2.length) {
            const cur = q2.shift();
            const n = nodes.find((no) => no.id === cur);
            if (!n) continue;
            path.push({
                id: n.id,
                flow_id: data.id,
                order: path.length + 1,
                ...(n.data.type === "primary" ? { classification_id: n.data.id } : { subclassification_id: n.data.id }),
            });
            const neigh = adj[cur] || [];
            for (const nb of neigh) {
                if (seen2.has(nb)) continue;
                if (!keptNodeIds.has(nb)) continue;
                seen2.add(nb);
                q2.push(nb);
            }
        }

        setNodes(newNodes);
        setEdges(newEdges);

        return { nodes: newNodes, edges: newEdges, path };
    }, [getPath, nodes, edges]);

    const initialValues = (() => {
        const base = {
            name: data?.name || "",
            is_active: data?.is_active ?? true,
        };
        if (data && typeof data === "object") {
            const { json_flujo, ...rest } = data;
            return { ...base, ...rest };
        }
        return base;
    })();

    return (
        <Formik
            innerRef={formikRef}
            initialValues={initialValues}
            validationSchema={joiFormikAdapter(ClassificationFlowSchema)}
            enableReinitialize
            onSubmit={async (values, { setErrors, setStatus }) => {
                if (isSeeMode) return;
                const cleaned = cleanFlow();
                const path = cleaned.path || [];
                const startEdge = (cleaned.edges || []).find((e) => e.source === "0");

                if (!startEdge || (path.length > 0 && !path[0].classification_id)) {
                    setStatus({ error: t("classificationFlow.errors.primaryRequired") });
                    return;
                }

                const json_flujo = { nodes: cleaned.nodes, edges: cleaned.edges };
                dataHandler(path, { ...values, json_flujo }, setErrors, setStatus);
            }}
        >
            <Form
                className="flex w-full justify-center"
                autoComplete="off"
                {...(isSeeMode && { onSubmit: (event) => event.preventDefault() })}
            >
                <FormCard
                    isId={data?.id}
                    title={t("classificationFlow.title", "Subclassification Flow")}
                    isSending={isSending}
                    lockChildrenInSeeMode={false}
                >
                    <div className="flex col-span-12 flex-col-reverse lg:grid grid-cols-5 lg:items-start gap-8">
                        <SectionForm className="col-span-3">
                            <div className="col-span-12 h-screen mx-1 border rounded-md my-2 border-brand flex flex-col justify-stretch relative overflow-hidden">
                                <fieldset
                                    disabled={isSeeMode}
                                    className="col-span-12 flex py-2 absolute top-0 w-full z-10 bg-white/75 shadow-md min-w-0"
                                    data-testid="classification_flow_form_node_toolbar"
                                >
                                    <div className="flex flex-1 justify-center px-2">
                                        <ClassificationSelect
                                            label={t("classificationFlow.sub", "Subclassification")}
                                            nextY={getNextY()}
                                            onSelect={addNode}
                                            type="subclassification"
                                        />
                                    </div>
                                </fieldset>
                                <div style={{ width: "100%", height: "100%" }}>
                                    {showDiagram && (
                                        <>
                                            <style>{`.end-node > .react-flow__handle-bottom { display: none !important; }`}</style>
                                            <FlowDiagram
                                                initialNodes={nodes}
                                                initialEdges={edges}
                                                forceSequential={false}
                                                externalUpdateNodes={setNodes}
                                                externalUpdateEdges={setEdges}
                                                isControlled={true}
                                                fieldName="json_flujo"
                                                zoomOnScroll={false}
                                                readOnly={isSeeMode}
                                            />
                                        </>
                                    )}
                                </div>
                            </div>
                        </SectionForm>
                    </div>
                </FormCard>
            </Form>
        </Formik>
    );
};

CreateClassificationFlowForm.propTypes = {
    dataHandler: PropTypes.func.isRequired,
    data: PropTypes.object,
    isSending: PropTypes.bool,
};

export default CreateClassificationFlowForm;

import PropTypes from "prop-types";
import { createContext, useCallback, useContext, useEffect, useRef, useState, useMemo } from "react";
import ReactFlow, { Background, Controls, MiniMap, applyNodeChanges, addEdge, updateEdge } from "reactflow";
import "reactflow/dist/style.css";
import { CustomEdge } from "./CustomEdge";
import { Dialog, DialogContent, DialogPortal, DialogTitle } from "@/components/ui-shared";
import Select from "@/componentsV2/core/Select";
import { useTranslation } from "react-i18next";
import { useFormikContext } from "formik";
import { CustomNode, ConditionalNode } from "./NodeTypes";
import { EdgeControlPanel } from "./EdgeControlPanel";

const EdgeConfigPopup = ({ isOpen, onClose, onSelect, ansList = [], rulesList = [], enableRuleSelection = false }) => {
    const { t } = useTranslation();
    const [selectedAns, setSelectedAns] = useState(null);
    const [selectedRule, setSelectedRule] = useState(null);

    const handleConfirm = () => {
        onSelect({ ans: selectedAns, rule: selectedRule });
        setSelectedAns(null);
        setSelectedRule(null);
    };

    const handleClose = () => {
        setSelectedAns(null);
        setSelectedRule(null);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogPortal>
                <DialogContent>
                    <DialogTitle>{t("flow.edgeConfig.title", "Configurar transición")}</DialogTitle>

                    {ansList?.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <span className="text-sm font-medium">
                                {t("flow.edgeConfig.selectAns", "Seleccionar ANS")}
                            </span>
                            <Select
                                t={t}
                                options={ansList}
                                value={selectedAns?.value != null ? String(selectedAns.value) : ""}
                                onChangeHandler={(value) =>
                                    setSelectedAns(ansList.find((ans) => String(ans.value) === String(value)) ?? null)
                                }
                                handlerClear={() => setSelectedAns(null)}
                            />
                        </div>
                    )}

                    {enableRuleSelection && (
                        <div className="flex flex-col gap-2">
                            <span className="text-sm font-medium">
                                {t("flow.edgeConfig.selectRule", "Seleccionar Regla de Transición")}
                            </span>
                            {rulesList?.length > 0 ? (
                                <Select
                                    t={t}
                                    options={rulesList}
                                    value={selectedRule?.value != null ? String(selectedRule.value) : ""}
                                    onChangeHandler={(value) =>
                                        setSelectedRule(
                                            rulesList.find((r) => String(r.value) === String(value)) ?? null,
                                        )
                                    }
                                    handlerClear={() => setSelectedRule(null)}
                                />
                            ) : (
                                <span className="text-xs text-gray-400">
                                    {t("flow.edgeConfig.noRules", "No hay reglas configuradas")}
                                </span>
                            )}
                        </div>
                    )}

                    <div className="flex justify-end gap-2 mt-4">
                        <button type="button" className="px-4 py-2 text-sm rounded border" onClick={handleClose}>
                            {t("common.cancel", "Cancelar")}
                        </button>
                        <button
                            type="button"
                            className="px-4 py-2 text-sm rounded bg-primary text-primary-foreground"
                            onClick={handleConfirm}
                        >
                            {t("common.confirm", "Confirmar")}
                        </button>
                    </div>
                </DialogContent>
            </DialogPortal>
        </Dialog>
    );
};

const NodeDeleteContext = createContext(null);

const withNodeDelete = (Node) => {
    const NodeWithDelete = (props) => {
        const onDelete = useContext(NodeDeleteContext);
        return <Node {...props} onDelete={onDelete} />;
    };
    NodeWithDelete.displayName = `WithNodeDelete(${Node.name})`;
    return NodeWithDelete;
};

const nodeTypes = {
    custom: withNodeDelete(CustomNode),
    conditional: withNodeDelete(ConditionalNode),
};

const parseDroppedNode = (payload) => {
    try {
        return JSON.parse(payload) ?? {};
    } catch {
        return {};
    }
};

export const FlowDiagram = ({
    availableNodes,
    initialNodes,
    initialEdges,
    forceSequential = false,
    onNodeSelected = null,
    externalUpdateNodes = null,
    externalUpdateEdges = null,
    fieldName = "json_flujo",
    zoomOnScroll = true,
    enableAnsSelection = false,
    ansList = [],
    enableRuleSelection = false,
    rulesList = [],
    showEdgeControls = true,
    allowRootFunction = false,
    edgeControlClassName = "",
    showEdgeSelectHint = true,
    readOnly = false,
}) => {
    const { setFieldValue } = useFormikContext();
    const edgeUpdateSuccessful = useRef(true);
    const dragActive = useRef(false);
    const selectionTimeout = useRef(null);

    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [showAnsPopup, setShowAnsPopup] = useState(false);
    const [pendingConnection, setPendingConnection] = useState(null);
    const [selectedEdge, setSelectedEdge] = useState(null);

    const updateNodes = (helper) => (externalUpdateNodes ? externalUpdateNodes(helper) : setNodes(helper));
    const updateEdges = (helper) => (externalUpdateEdges ? externalUpdateEdges(helper) : setEdges(helper));

    useEffect(() => {
        setNodes(initialNodes);
    }, [initialNodes]);

    useEffect(() => {
        setEdges(initialEdges);
    }, [initialEdges]);

    const onNodeDragStart = useCallback(() => {
        dragActive.current = true;
    }, []);

    const onNodeDragStop = useCallback(() => {
        dragActive.current = false;
    }, []);

    const deselectAllNodes = () => {
        updateNodes((nds) => nds.map((node) => ({ ...node, selected: false })));
    };

    const onNodesChange = useCallback(
        (changes) => {
            updateNodes((nds) => applyNodeChanges(changes, nds));

            if (!onNodeSelected) return;

            const selectedNode = changes.find((change) => !!change.selected && change.type === "select");

            if (!selectedNode) return;

            clearTimeout(selectionTimeout.current);

            selectionTimeout.current = setTimeout(() => {
                if (!dragActive.current) {
                    onNodeSelected(selectedNode);
                } else {
                    deselectAllNodes();
                }
            }, 100);
        },
        [nodes],
    );

    const comesFromConditional = (nodeId) => {
        return edges.some(
            (ed) => ed.target === nodeId && nodes.find((n) => n.id === ed.source)?.data?.type === "conditional",
        );
    };

    const canConnectToFunction = (source, targetNode) => {
        if (allowRootFunction) return true;
        return targetNode?.data.type !== "function" || source !== "0";
    };

    const onConnect = useCallback(
        (params) => {
            if ((enableAnsSelection && ansList.length > 0) || enableRuleSelection) {
                setPendingConnection(params);
                setShowAnsPopup(true);
                return;
            }

            const sourceNode = nodes.find((n) => n.id === params.source);
            const sourceIsConditional = sourceNode?.data?.type === "conditional";
            const sourceComesFromConditional = comesFromConditional(params.source);
            const allowMultipleTargetConnections = sourceIsConditional || sourceComesFromConditional;

            updateEdges((eds) => {
                if (forceSequential && !allowMultipleTargetConnections) {
                    const targetNode = nodes.find((nd) => nd.id === params.target);
                    const isValid = canConnectToFunction(params.source, targetNode);

                    if (!isValid) {
                        return eds;
                    }

                    eds = eds.filter((ed) => ed.source !== params.source && ed.target !== params.target && isValid);
                }

                return addEdge({ ...params, type: "custom", data: { is_visible: true } }, eds);
            });
        },
        [nodes, edges, enableAnsSelection, ansList, enableRuleSelection],
    );

    const handleEdgeConfigSelect = useCallback(
        ({ ans = null, rule = null } = {}) => {
            if (pendingConnection) {
                updateEdges((eds) => {
                    if (forceSequential) {
                        const targetNode = nodes.find((nd) => nd.id === pendingConnection.target);
                        const isValid = canConnectToFunction(pendingConnection.source, targetNode);

                        if (!isValid) {
                            return eds;
                        }

                        eds = eds.filter(
                            (ed) =>
                                ed.source !== pendingConnection.source &&
                                ed.target !== pendingConnection.target &&
                                isValid,
                        );
                    }

                    return addEdge(
                        {
                            ...pendingConnection,
                            type: "custom",
                            label: ans?.label || null,
                            ans_id: ans?.value || null,
                            rule_id: rule?.value || null,
                            data: { is_visible: true, rule_label: rule?.label || null },
                        },
                        eds,
                    );
                });
            }
            setShowAnsPopup(false);
            setPendingConnection(null);
        },
        [pendingConnection, nodes, forceSequential],
    );

    const handleAnsPopupClose = useCallback(() => {
        handleEdgeConfigSelect();
        setShowAnsPopup(false);
        setPendingConnection(null);
    }, [handleEdgeConfigSelect]);

    const deleteEdge = useCallback((edgeId) => {
        updateEdges((eds) => eds.filter((e) => e.id !== edgeId));
        setSelectedEdge(null);
    }, []);

    const onEdgeUpdateStart = useCallback(() => {
        edgeUpdateSuccessful.current = false;
    }, []);

    const onEdgeUpdate = useCallback((oldEdge, newConnection) => {
        edgeUpdateSuccessful.current = true;
        updateEdges((els) =>
            updateEdge(
                oldEdge,
                {
                    ...newConnection,
                    type: "custom",
                    data: { ...oldEdge.data, is_visible: oldEdge.data?.is_visible ?? true },
                },
                els,
            ),
        );
    }, []);

    const onEdgeUpdateEnd = useCallback((_, edge) => {
        if (!edgeUpdateSuccessful.current) {
            updateEdges((eds) => eds.filter((e) => e.id !== edge.id));
        }

        edgeUpdateSuccessful.current = true;
    }, []);

    const handleBlur = () => {
        setFieldValue && setFieldValue(fieldName, { nodes, edges });
    };

    const onDragOver = (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
    };

    const onDrop = (event) => {
        event.preventDefault();
        const reactFlowBounds = event.target.getBoundingClientRect();
        const { nodeName, nodeId } = parseDroppedNode(event.dataTransfer.getData("application/reactflow"));
        if (!nodeName) return;

        const position = {
            x: event.clientX - reactFlowBounds.left,
            y: event.clientY - reactFlowBounds.top,
        };
        const exitsNode = edges.find((ed) => ed.source === nodeId || ed.target === nodeId);
        if (!exitsNode) {
            const newNode = {
                id: nodeId,
                position,
                type: "custom",
                data: { label: nodeName },
                selected: false,
                positionAbsolute: { x: 0, y: 0 },
                dragging: false,
                style: {
                    background: "rgba(208, 192, 247, 0.5)",
                    color: "#A100C2",
                    fontWeight: "bold",
                    border: "2px solid #A100C2",
                },
            };
            updateNodes((nds) => nds.concat(newNode));
        }
    };

    const deleteNode = useCallback(
        (nodeId) => {
            updateNodes((nds) => nds.filter((node) => node.id !== nodeId));
            updateEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
        },
        [externalUpdateNodes, externalUpdateEdges],
    );

    const toggleEdgeVisibility = useCallback(
        (edgeId) => {
            updateEdges((eds) => {
                const newEdges = eds.map((edge) =>
                    edge.id === edgeId
                        ? {
                              ...edge,
                              data: {
                                  ...edge.data,
                                  is_visible: !(edge.data?.is_visible ?? true),
                              },
                          }
                        : edge,
                );
                const updatedEdge = newEdges.find((e) => e.id === edgeId);
                if (updatedEdge && selectedEdge?.id === edgeId) {
                    setSelectedEdge(updatedEdge);
                }
                return newEdges;
            });
        },
        [selectedEdge],
    );

    const onEdgeClick = useCallback((event, edge) => {
        event.stopPropagation();
        setSelectedEdge(edge);
        updateEdges((eds) => {
            const newEdges = eds.map((e) => ({
                ...e,
                selected: e.id === edge.id,
                zIndex: e.id === edge.id ? 1000 : 0,
            }));

            return newEdges.sort((a, b) => (a.selected === b.selected ? 0 : a.selected ? 1 : -1));
        });
    }, []);

    const onPaneClick = useCallback(() => {
        setSelectedEdge(null);
        updateEdges((eds) =>
            eds.map((e) => ({
                ...e,
                selected: false,
            })),
        );
    }, []);

    const edgeTypes = useMemo(
        () => ({
            custom: (props) => <CustomEdge {...props} data={{ ...props.data }} />,
        }),
        [],
    );

    useEffect(() => {
        const newNodes = [...initialNodes];
        const newEdges = [...initialEdges];

        if (newEdges.length === 0 && !newNodes.some((n) => n.id === "0")) {
            newNodes.push({
                id: "0",
                type: "input",
                position: { x: 300, y: 0 },
                data: { label: "inicio" },
                selected: false,
                positionAbsolute: { x: 0, y: 0 },
                dragging: false,
                style: {
                    background: "rgba(208, 192, 247, 0.5)",
                    color: "#A100C2",
                    fontWeight: "bold",
                    border: "2px solid #A100C2",
                },
            });
        }

        updateNodes((prevNodes) => {
            if (JSON.stringify(prevNodes) !== JSON.stringify(newNodes)) {
                return newNodes;
            }
            return prevNodes;
        });

        updateEdges((prevEdges) => {
            const processedNewEdges = newEdges.map((edge) => ({
                ...edge,
                type: "custom",
                data: {
                    ...edge.data,
                    is_visible: edge.data?.is_visible ?? true,
                },
            }));

            if (JSON.stringify(prevEdges) !== JSON.stringify(processedNewEdges)) {
                return processedNewEdges;
            }
            return prevEdges;
        });

        setFieldValue && setFieldValue(fieldName, { nodes: newNodes, edges: newEdges });
    }, [initialNodes, initialEdges, availableNodes, setFieldValue]);

    const onNodeContextMenu = (event) => {
        event.preventDefault();
        const node = event.target?.attributes?.["data-id"]?.value;
        const permanent = event.target?.classList?.contains("permanent");

        if (node && !permanent) {
            deleteNode(node);
        }
    };

    const containerEditHandlers = readOnly ? {} : { onDrop, onDragOver };
    const flowEditHandlers = readOnly ? {} : { onNodeContextMenu, onConnect, onEdgeClick, onPaneClick };

    return (
        <div
            style={{ height: "100%", position: "relative" }}
            {...containerEditHandlers}
            id="flows_form_diagram_container"
            data-testid="flows_form_diagram_container"
        >
            <NodeDeleteContext.Provider value={readOnly ? null : deleteNode}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    {...flowEditHandlers}
                    onNodeDragStart={onNodeDragStart}
                    onNodeDragStop={onNodeDragStop}
                    onNodesChange={onNodesChange}
                    onEdgeUpdate={onEdgeUpdate}
                    onEdgeUpdateStart={onEdgeUpdateStart}
                    onEdgeUpdateEnd={onEdgeUpdateEnd}
                    onBlur={handleBlur}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    nodesDraggable={!readOnly}
                    nodesConnectable={!readOnly}
                    elementsSelectable={!readOnly}
                    edgesUpdatable={!readOnly}
                    deleteKeyCode={readOnly ? null : undefined}
                    zoomOnScroll={zoomOnScroll}
                    preventScrolling={zoomOnScroll}
                >
                    <Controls id="flows_form_controls" data-testid="flows_form_controls" showInteractive={!readOnly} />
                    <MiniMap id="flows_form_minimap" data-testid="flows_form_minimap" />
                    <Background variant="dots" gap={12} size={1} />
                </ReactFlow>
            </NodeDeleteContext.Provider>

            {showEdgeControls && !readOnly && (
                <EdgeControlPanel
                    edge={selectedEdge}
                    onVisibilityChange={toggleEdgeVisibility}
                    onDelete={deleteEdge}
                    className={edgeControlClassName}
                    showSelectHint={showEdgeSelectHint}
                />
            )}

            {(enableAnsSelection || enableRuleSelection) && (
                <EdgeConfigPopup
                    isOpen={showAnsPopup}
                    onClose={handleAnsPopupClose}
                    onSelect={handleEdgeConfigSelect}
                    ansList={enableAnsSelection ? ansList : []}
                    rulesList={rulesList}
                    enableRuleSelection={enableRuleSelection}
                />
            )}
        </div>
    );
};

FlowDiagram.propTypes = {
    availableNodes: PropTypes.array,
    initialNodes: PropTypes.array,
    initialEdges: PropTypes.array,
    forceSequential: PropTypes.bool,
    onNodeSelected: PropTypes.func,
    externalUpdateNodes: PropTypes.func,
    externalUpdateEdges: PropTypes.func,
    fieldName: PropTypes.string,
    zoomOnScroll: PropTypes.bool,
    enableAnsSelection: PropTypes.bool,
    ansList: PropTypes.arrayOf(
        PropTypes.shape({
            value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
            label: PropTypes.string.isRequired,
        }),
    ),
    enableRuleSelection: PropTypes.bool,
    rulesList: PropTypes.arrayOf(
        PropTypes.shape({
            value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
            label: PropTypes.string.isRequired,
        }),
    ),
    showEdgeControls: PropTypes.bool,
    allowRootFunction: PropTypes.bool,
    edgeControlClassName: PropTypes.string,
    showEdgeSelectHint: PropTypes.bool,
    readOnly: PropTypes.bool,
};

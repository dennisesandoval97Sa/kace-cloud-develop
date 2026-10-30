import PropTypes from "prop-types";
import { Handle, Position } from "reactflow";
import { formatTestId } from "@/utils/src/helpers";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export const ConditionalNode = ({ id, data, onDelete, isConnectable }) => {
    const { t } = useTranslation();
    return (
        <div
            style={{
                width: 120,
                height: 120,
                background: "rgb(217, 242, 221)",
                border: "2px solid rgb(88, 159, 103)",
                transform: "rotate(45deg)",
                position: "relative",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
            }}
        >
            <div
                style={{
                    transform: "rotate(-45deg)",
                    textAlign: "center",
                    width: "100px",
                    fontSize: "13px",
                    pointerEvents: "none",
                }}
            >
                {data.label ?? t("restFlow.newConditional")}
            </div>

            {/* Delete Btn */}
            {onDelete && (
                <button
                    type="button"
                    onClick={() => onDelete(id)}
                    style={{
                        position: "absolute",
                        transform: "rotate(-45deg)",
                        padding: 0,
                        cursor: "pointer",
                        color: "#e76e50",
                        left: 5,
                        top: 5,
                    }}
                >
                    <Trash2 width={18} height={18} />
                </button>
            )}

            {/* Top */}
            <Handle
                isConnectable={isConnectable}
                type="target"
                position={Position.Top}
                id="in"
                style={{
                    top: 0,
                    left: -3,
                    transform: "translateY(-50%) rotate(-45deg)",
                }}
            />

            {/* Left - No */}
            <span
                style={{
                    position: "absolute",
                    transform: "translateY(-50%) rotate(-45deg)",
                    color: "#e76e50",
                    fontSize: 12,
                    bottom: -10,
                    left: -20,
                }}
            >
                {t("actions.querybuilder.operatorLabels.no")}
            </span>
            <Handle
                isConnectable={isConnectable}
                type="source"
                position={Position.Left}
                id="no"
                style={{
                    background: "#e76e50",
                    width: 10,
                    height: 10,
                    top: 120,
                }}
            />

            {/* Right yes */}
            <span
                style={{
                    position: "absolute",
                    transform: "translateY(-50%) rotate(-45deg)",
                    color: "#2a9d90",
                    fontSize: 12,
                    top: -14,
                    right: -6,
                }}
            >
                {t("actions.querybuilder.operatorLabels.yes")}
            </span>
            <Handle
                isConnectable={isConnectable}
                type="source"
                position={Position.Right}
                id="yes"
                style={{
                    background: "#2a9d90",
                    width: 10,
                    height: 10,
                    top: 0,
                }}
            />
        </div>
    );
};

export const CustomNode = ({ id, data, onDelete, isConnectable }) => {
    return (
        <div
            className="react-flow__node react-flow__node-default selectable"
            style={{
                padding: "10px",
                background: "rgba(208, 192, 247)",
                color: "#A100C2",
                fontWeight: "bold",
                border: "2px solid #A100C2",
            }}
            id={formatTestId("flows_form_node", data?.label)}
            data-testid={formatTestId("flows_form_node", data?.label)}
        >
            {onDelete && (
                <button
                    type="button"
                    onClick={() => onDelete(id)}
                    style={{
                        position: "absolute",
                        top: "1px",
                        right: "1px",
                        padding: "0",
                        cursor: "pointer",
                    }}
                    id={formatTestId("btn_flows_node_delete", data?.label)}
                    data-testid={formatTestId("btn_flows_node_delete", data?.label)}
                >
                    <Trash2 width={18} height={18} />
                </button>
            )}
            <div
                id={formatTestId("custon_node", `${data.label}`)}
                data-testid={formatTestId("custon_node", `${data.label}`)}
            >
                {data.label}
            </div>
            <Handle
                isConnectable={isConnectable}
                type="source"
                position="bottom"
                style={{ background: "black" }}
                id="bottom"
                data-testid={formatTestId("flows_handle_bottom", data?.label)}
            />
            <Handle
                isConnectable={isConnectable}
                type="target"
                position="top"
                style={{ background: "black" }}
                id="top"
                data-testid={formatTestId("flows_handle_top", data?.label)}
            />
        </div>
    );
};

const nodePropTypes = {
    id: PropTypes.string.isRequired,
    data: PropTypes.shape({ label: PropTypes.string }).isRequired,
    onDelete: PropTypes.func,
    isConnectable: PropTypes.bool,
};

ConditionalNode.propTypes = nodePropTypes;
CustomNode.propTypes = nodePropTypes;

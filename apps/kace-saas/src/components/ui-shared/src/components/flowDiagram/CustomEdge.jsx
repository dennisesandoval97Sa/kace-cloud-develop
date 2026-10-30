import PropTypes from "prop-types";
import { BaseEdge, getBezierPath, EdgeLabelRenderer } from "reactflow";
import { formatTestId } from "@/utils/src/helpers";

export const CustomEdge = (props) => {
    const {
        id,
        source,
        target,
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
        style,
        label,
        data,
        onDelete,
        selected,
    } = props;

    const visible = data?.is_visible ?? true;
    const rule_label = data?.rule_label ?? null;

    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    const edgeStyle = {
        ...style,
        strokeDasharray: visible ? "0" : "5,5",
        opacity: visible ? 1 : 0.5,
        stroke: selected ? "#A100C2" : visible ? style?.stroke || "#b1b1b7" : "#9ca3af",
        strokeWidth: selected ? 2 : 1.5,
        zIndex: selected ? 50 : 0,
    };

    return (
        <>
            <BaseEdge
                path={edgePath}
                style={edgeStyle}
                id={formatTestId("flows_form_edge", `${source}_${target}`)}
                data-testid={formatTestId("flows_form_edge", `${source}_${target}`)}
            />
            <EdgeLabelRenderer>
                {label && (
                    <div
                        className="absolute text-xs px-2 py-1 rounded border font-bold flex items-center justify-center gap-1 pointer-events-none"
                        style={{
                            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY - (rule_label ? 14 : 0)}px)`,
                            zIndex: selected ? 1000 : 10,
                            backgroundColor: visible ? "#fde68a" : "#fef3c7",
                            borderColor: "#b45309",
                            color: "#b45309",
                        }}
                    >
                        <span>{label}</span>
                    </div>
                )}
                {rule_label && (
                    <div
                        className="absolute text-xs px-2 py-1 rounded border font-bold flex items-center justify-center gap-1 pointer-events-none"
                        style={{
                            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY + (label ? 14 : 0)}px)`,
                            zIndex: selected ? 1000 : 10,
                            backgroundColor: visible ? "#ede9fe" : "#f5f3ff",
                            borderColor: "#7c3aed",
                            color: "#7c3aed",
                        }}
                    >
                        <span>{rule_label}</span>
                    </div>
                )}
            </EdgeLabelRenderer>
        </>
    );
};

CustomEdge.propTypes = {
    id: PropTypes.string,
    source: PropTypes.string,
    target: PropTypes.string,
    sourceX: PropTypes.number,
    sourceY: PropTypes.number,
    targetX: PropTypes.number,
    targetY: PropTypes.number,
    sourcePosition: PropTypes.string,
    targetPosition: PropTypes.string,
    style: PropTypes.object,
    label: PropTypes.string,
    data: PropTypes.object,
    onDelete: PropTypes.func,
};

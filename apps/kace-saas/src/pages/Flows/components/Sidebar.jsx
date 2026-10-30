import { formatTestId } from "@/utils/src/helpers";

export const Sidebar = ({ availableNodes }) => {
    const onDragStart = (event, nodeName, nodeId) => {
        const nodeData = JSON.stringify({ nodeName, nodeId });
        event.dataTransfer.setData("application/reactflow", nodeData);
        event.dataTransfer.effectAllowed = "move"
    }

    return (
        <div className='col-span-1'>
            {availableNodes.slice(0, 10).map((node) => (
                <div
                    key={node.id}
                    className="m-2 text-center	"
                    onDragStart={(event) => onDragStart(event, node.nombre, node.id)}
                    draggable
                    style={{
                        zIndex: 0,
                        pointerEvents: "all",
                        visibility: "visible",
                        color: "rgb(161, 0, 194)",
                        border: "2px solid rgb(161, 0, 194)",
                        background: "rgba(208, 192, 247, 0.5)",
                        fontWeight: "bold",
                        padding: "10px",
                        borderRadius: "3px",
                        width: "150px",
                        fontSize: "12px"
                    }}
                    id={formatTestId("sidebar", node.nombre)}
                    data-testid={formatTestId("sidebar", node.nombre)}
                >
                    {node.nombre}
                </div>
            ))}
        </div>
    )
}

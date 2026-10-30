import { PropTypes } from "prop-types"
import { Link } from "react-router-dom"
import { useCallback } from "react"
import { useQuery } from "@tanstack/react-query"

import { WS_REST_FLOWS_SERVICE } from "@kace/urls"

import { genericView } from "../../../services/genericView"
import { formatTestId } from "@/utils/src/helpers"

const EndpointDetailsModalFlows = ({
    key,
    title,
    data
}) => {
    const { data: flows } = useQuery({
        queryKey: ["wsRestFlowsList", key],
        queryFn: async () => genericView(`${WS_REST_FLOWS_SERVICE}`)
    })

    const getFlowName = useCallback((id) => {
        return flows?.find(flow => flow.id === id)?.external_code
    }, [flows])

    return (
        <div className="flex flex-col">
            <span className="font-bold" id="end_points_flows_title" data-testid="end_points_flows_title">
                {title}
            </span>
            <ul>
                {Object.keys(data?.flows ?? {}).map((code) => (
                    <li key={`${key}_flow_${code}`} id={formatTestId("end_points_list_flow", `${code}`)} data-testid={formatTestId("end_points_list_flow", `${code}`)}>
                        <Link to={`/rest-flows/update/${data.flows[code]}?action=see`} id="end_points_list_flow_link" data-testid="end_points_list_flow_link">
                            {code} &gt; {getFlowName(data.flows[code])}
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}

EndpointDetailsModalFlows.propTypes = {
    key: PropTypes.string.isRequired,
    title: PropTypes.string,
    data: PropTypes.object.isRequired
}

export default EndpointDetailsModalFlows

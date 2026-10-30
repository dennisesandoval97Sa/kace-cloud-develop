import { WSRestEndpointType } from "../../../enums/WSRestEndpointType";

export const filterEndpoinds = () => {
    return [
        {
            field: "ws_rest_endpoints.type",
            operator: "eq",
            value: WSRestEndpointType.CONSUMPTION.value,
            type: "AND",
        },
    ];
};

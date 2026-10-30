import { useState, useCallback } from "react";
import { filterUserByGroup } from "../data/queries.js";
import { INITIAL_VALUES_GEOLOCATION } from "../data/constans.js";
import useUserInformation from "@kace/hooks/useUserInformation";
import { parse } from "date-fns";

const useDataGeolocation = () => {
    const { user } = useUserInformation();
    const [selectedUser, setSelectedUser] = useState(user?.id);
    const [selectedGroup, setSelectedGroup] = useState(user?.selectedGroup);
    const [marketPosition, setMarketPosition] = useState(INITIAL_VALUES_GEOLOCATION);
    const relationship = filterUserByGroup(selectedGroup || user?.selectedGroup);
    const getUnixTimestamp = useCallback((date) => {
        const dateObj = parse(date, "dd/MM/yyyy hh:mm:ss a", new Date());
        return Math.floor(dateObj.getTime() / 1000);
    }, []);

    const handleSeeGeolocation = useCallback(
        (all = false, { latitud, longitud, ...rest } = {}) => {
            if (all) {
                const order = all.sort((a, b) => getUnixTimestamp(a.created_at) - getUnixTimestamp(b.created_at));
                setMarketPosition(order);
            } else {
                setMarketPosition([{ latitude: latitud, longitude: longitud, ...rest }]);
            }
        },
        [getUnixTimestamp],
    );

    const handleSelectUser = (_, id) => {
        setSelectedUser(id);
    };
    const handleSelectGroup = (_, id) => {
        setSelectedGroup(id);
    };

    const handlerOptionsUsers = (options) => {
        if (Array.isArray(options)) {
            const newOptions = options[0].value.map((item) => ({
                value: item.id,
                label: `${item.nombres || ""} ${item.apellido1 || ""} ${item.apellido2 || ""}`,
            }));
            return newOptions;
        }
    };

    const handleOptionsGroups = (options) => {
        if (Array.isArray(options)) {
            const newOptions = options[0].value.map((item) => ({
                value: item.id,
                label: item.nombre,
            }));
            return newOptions;
        }
    };

    return {
        marketPosition,
        handleSeeGeolocation,
        selectedUser,
        selectedGroup,
        handleSelectUser,
        handleSelectGroup,
        relationship,
        handlerOptionsUsers,
        handleOptionsGroups,
    };
};

export default useDataGeolocation;

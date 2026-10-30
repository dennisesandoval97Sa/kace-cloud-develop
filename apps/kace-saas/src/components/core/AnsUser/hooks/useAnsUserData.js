import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { genericView } from "../../../../services/genericView";
import { CASES_COUNT_BY_RESPONSABLE_SERVICE } from "../../../../utils/URL";

export const useAnsUserData = (idUser) => {
    const [ansUser, setAnsUser] = useState({});

    const {
        data: dataAnsUser = [], isLoading,
    } = useQuery({
        queryKey: ["ansUserData"],
        queryFn: async () =>
            genericView(`${CASES_COUNT_BY_RESPONSABLE_SERVICE}/${idUser}`, []),
        staleTime: 1000 * 60 * 60,
        retry: 1,
        enabled: !!idUser,
    });

    useEffect(() => {
        if (dataAnsUser && dataAnsUser.ans) {
            setAnsUser(dataAnsUser);
        }
    }, [dataAnsUser]);

    return {
        ansUser,
        isLoading,
    };
};

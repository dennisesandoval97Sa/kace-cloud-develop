import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useGeneralDelete from "../../../hooks/useGeneralDelete";
import useGenericSearchQuery from "../../../hooks/useGenericSearchQuery";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";
import { getClassificationLevels, getUsers } from "../utils/helpers";

const useActionsData = () => {
    const [classificationDescriptionData, setClassificationDescriptionData] = useState([]);
    const [arrayAllLevels, setArrayAllLevels] = useState([]);
    const [levelsSelect, setLevelsSelect] = useState([
        { name: "clasificaciones.description", type: "list", data: "classifications" },
        { name: "cases.estadoActual", type: "list", data: "casos" },
        { name: "cases.responsable_id", type: "list", data: "casos" },
    ]);
    const [statesData, setStatesData] = useState([]);
    const navigate = useNavigate();
    const { mutate: deleteAction } = useGeneralDelete({
        keyQuery: URL_AND_KEYS.actions.key,
    });

    const { data: levelsData, isLoading: loadingLevelsData } = useQuery({
        queryKey: [URL_AND_KEYS.classification.keyClassificationLevels],
        queryFn: () => getClassificationLevels(),
        staleTime: 1000 * 60 * 60 * 7,
        gcTime: 1000 * 60 * 60 * 8,
    });

    const { data: usersData, isLoading: userDataLoading } = useQuery({
        queryKey: ["test"],
        queryFn: () => getUsers(),
        staleTime: 1000 * 60 * 60 * 7,
        gcTime: 1000 * 60 * 60 * 8,
    });

    useEffect(() => {
        if (levelsData) {
            const newLevelItems = [];
            const newLevelSelects = [];
            levelsData.forEach((itemLevels) => {
                const { data, level } = itemLevels;
                data.forEach((item, index) => {
                    if (item !== null && item !== "") {
                        newLevelItems.push({ label: item, value: item, level, id: index });
                    }
                });
                newLevelSelects.push({ name: `clasificaciones.${level}`, type: "list", data: "classifications" });
            });
            setArrayAllLevels(newLevelItems);
            setLevelsSelect((prev) => [...prev, ...newLevelSelects]);
        }
    }, [levelsData]);

    const { data: statesQuery, isLoading: loadingStatesData } = useGenericSearchQuery({
        url: `${URL_AND_KEYS.states.url}/search`,
        keyQuery: URL_AND_KEYS.states.key,
        select: (data) => data.data,
    });

    const { data: classificationDataDescription, isLoading: loadingClassificationDataDescription } =
        useGenericSearchQuery({
            url: `${URL_AND_KEYS.classification.url}/search`,
            keyQuery: URL_AND_KEYS.classification.key,
            select: (data) => data.data,
        });

    useEffect(() => {
        if (classificationDataDescription) {
            const listDescriptions = classificationDataDescription.map((object) => {
                return {
                    id: object.id,
                    label: object.description,
                    value: object.id,
                };
            });
            setClassificationDescriptionData(listDescriptions);
        }
    }, [classificationDataDescription]);

    useEffect(() => {
        if (statesQuery) {
            const listStates = statesQuery.map((object) => {
                return {
                    id: object.id,
                    label: object.nombre,
                    value: object.id,
                };
            });
            setStatesData(listStates);
        }
    }, [statesQuery]);

    return {
        handleUpdateAction: (id) => {
            navigate(`/actions/update/${id}`);
        },
        handleDeleteAction: (id) => {
            deleteAction({ id, url: URL_AND_KEYS.actions.url });
        },
        handleSeeAction: (id) => {
            navigate(`/actions/update/${id}?action=see`);
        },
        loadingStatesData,
        statesData,
        loadingClassificationDataDescription,
        classificationDescriptionData,
        loadingLevelsData,
        arrayAllLevels,
        levelsSelect,
        usersData,
        userDataLoading,
    };
};

export default useActionsData;

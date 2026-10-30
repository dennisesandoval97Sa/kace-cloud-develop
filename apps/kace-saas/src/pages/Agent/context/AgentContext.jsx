import { Uuid } from "@kace/plugins";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import PropTypes from "prop-types";
import { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import useConfigAgentData from "../../../hooks/useConfigAgentData";
import { searchClientFetch } from "../../../services/searchClient";
import { INITIAL_VALUES_CLIENT } from "../data/Constants.js";

export const DEFAULT_AGENT_CONTEXT = {
    clientId: "",
    isNewClient: true,
    dataUserSelected: INITIAL_VALUES_CLIENT,
    setDataUserSelected: () => {},
    clearSelectedClient: () => {},
    configAgent: {},
};

const AgentContext = createContext(DEFAULT_AGENT_CONTEXT);

export const AgentProvider = ({ children }) => {
    const { clientId } = useParams();
    const isNewClient = !clientId;
    const [idClient, setIdClient] = useState("");
    const [dataUserSelected, setDataUserSelected] = useState(INITIAL_VALUES_CLIENT);
    const configAgent = useConfigAgentData();
    const queryClient = useQueryClient();

    const { mutate } = useMutation({
        mutationFn: searchClientFetch,
        onSuccess: (data) => {
            const client = data?.data?.[0] || INITIAL_VALUES_CLIENT;
            setDataUserSelected(client);
        },
        onError: () => {
            queryClient.setQueryData(["searchClientsForField"], { data: [] });
        },
    });

    useEffect(() => {
        if (clientId) {
            setIdClient(clientId);
            mutate({ payload: clientId, type: "id" });
        } else {
            const newId = Uuid();
            setIdClient(newId);
            setDataUserSelected(INITIAL_VALUES_CLIENT);
        }
    }, [clientId]);

    const clearSelectedClient = useCallback(() => {
        setIdClient("");
        setDataUserSelected(INITIAL_VALUES_CLIENT);
    }, []);

    const value = useMemo(
        () => ({
            clientId: idClient,
            isNewClient,
            dataUserSelected,
            setDataUserSelected,
            clearSelectedClient,
            configAgent,
        }),
        [idClient, isNewClient, dataUserSelected, setDataUserSelected, clearSelectedClient, configAgent],
    );

    return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
};

AgentProvider.propTypes = {
    children: PropTypes.node,
};

export const useAgentContext = () => useContext(AgentContext) ?? DEFAULT_AGENT_CONTEXT;

import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { AUX_SCHEMAS_SERVICE } from "@kace/urls";

import { INITIAL_VALUES_AUX_SCHEMAS } from "./data/constants";
import AuxSchemasForm from "./components/SchemasForm";
import useGeneralMutation from "@/hooks/useGeneralMutation";
import useGenericViewQuery from "@/hooks/useGenericViewQuery";
import { genericHandleSendInformation } from "@/services/genericHandleSendInformation";
import { DashboardSectionCard } from "@/components/core/Cards/DashboardSectionCard";

const AuxSchemaCreate = () => {
    const { id } = useParams();
    const [schemas, setSchemas] = useState(INITIAL_VALUES_AUX_SCHEMAS);

    const { mutate, isPending } = useGeneralMutation({
        keyQuery: "auxSchemasData",
        path: "/aux/schemas",
    });

    const { data: relationshipData } = useGenericViewQuery({
        keyQuery: "auxSchemasRelationshipData",
        url: `${AUX_SCHEMAS_SERVICE}/${id}/relations-count`,
        searchById: id,
        enabled: !!id,
    });

    const { data, isLoading } = useGenericViewQuery({
        keyQuery: "auxSchemasData",
        url: `${AUX_SCHEMAS_SERVICE}/${id}`,
        searchById: id,
        enabled: !!id,
    });

    const handleSchemas = (values, setFormikErrors, setFormikStatus) => {
        const data = genericHandleSendInformation({
            values,
            urlService: AUX_SCHEMAS_SERVICE,
            setFormikErrors,
            setFormikStatus,
            pending: isPending,
        });

        mutate(data);
    };

    useEffect(() => {
        if (data) {
            setSchemas(data);
        }
    }, [data]);

    const hasRelationships = useMemo(() => {
        return relationshipData?.related_count > 0;
    }, [relationshipData]);

    return (
        <DashboardSectionCard>
            <AuxSchemasForm
                dataHandler={handleSchemas}
                data={schemas}
                isSending={isPending || isLoading}
                hasRelationships={hasRelationships}
            />
        </DashboardSectionCard>
    );
};

export default AuxSchemaCreate;

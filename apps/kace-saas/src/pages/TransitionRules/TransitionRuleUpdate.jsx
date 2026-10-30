import { useEffect, useState } from "react";
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard";
import { TransitionRuleForm } from "./components/TransitionRuleForm";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { genericView } from "../../services/genericView";
import useGeneralMutation from "../../hooks/useGeneralMutation";
import { genericHandleSendInformation } from "../../services/genericHandleSendInformation";
import { TRANSITION_RULES_SERVICE } from "@/utils/main";
import { useTranslation } from "react-i18next";

export const TransitionRuleUpdate = () => {
    const [ruleData, setRuleData] = useState(null);
    const { id } = useParams();
    const { t } = useTranslation();

    const { data: dataFromServer } = useQuery({
        queryKey: ["transitionRuleForm", id],
        queryFn: async () => genericView(`${TRANSITION_RULES_SERVICE}/${id}`),
        enabled: !!id,
    });

    const { mutate, isPending } = useGeneralMutation({
        keyQuery: "transitionRules",
        path: "/transition-rules",
    });

    const handleSubmit = (values, setFormikErrors, setFormikStatus) => {
        const data = genericHandleSendInformation({
            values,
            urlService: TRANSITION_RULES_SERVICE,
            setFormikErrors,
            setFormikStatus,
            pending: isPending,
        });
        mutate(data);
    };

    useEffect(() => {
        if (dataFromServer) {
            const cleanedData = Object.fromEntries(
                Object.entries(dataFromServer).map(([key, value]) => [key, value ?? ""]),
            );
            setRuleData(cleanedData);
        }
    }, [dataFromServer]);

    return (
        <DashboardSectionCard title={t("navbar.transitionRules")}>
            <TransitionRuleForm data={ruleData} dataHandler={handleSubmit} isSending={isPending} />
        </DashboardSectionCard>
    );
};

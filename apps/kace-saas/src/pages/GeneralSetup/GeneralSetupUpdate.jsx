import { useEffect, useState } from "react";
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard";
import { GeneralSetupForm } from "./components/GeneralSetupForm";
import { GENERAL_SETUP_SERVICE } from "@kace/utils";
import useGeneralMutation from "../../hooks/useGeneralMutation";
import { genericHandleSendInformation } from "../../services/genericHandleSendInformation";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { genericView } from "../../services/genericView";
import { transformDataToFormValues } from "./helpers";
import { useSelector, useDispatch } from "react-redux";
import { setShowGroupsSelect } from "../../redux/state/showGroupSelect";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

const GeneralSetupUpdate = () => {
    const [generalSetup, setGeneralSetup] = useState(null);
    const { id } = useParams();
    const dispatch = useDispatch();
    const idConfig = useSelector((state) => state.generalSetup.idConfig);

    const { data: dataGeneralSetup } = useQuery({
        queryKey: ["generalSetupForm", id],
        queryFn: async () => genericView(`${GENERAL_SETUP_SERVICE}/${id}`),
        enabled: !!id,
    });

    const { mutate, isPending } = useGeneralMutation({
        keyQuery: URL_AND_KEYS.globalConfiguration.key,
        path: URL_AND_KEYS.globalConfiguration.route,
    });

    const handleGeneralSetupUpdate = (values, setFormikErrors, setFormikStatus) => {
        const data = genericHandleSendInformation({
            values: { id, ...values },
            urlService: GENERAL_SETUP_SERVICE,
            setFormikErrors,
            setFormikStatus,
            pending: isPending,
        });
        mutate(data, {
            onSuccess: () => {
                if (id === idConfig) {
                    dispatch(setShowGroupsSelect(true));
                    localStorage.removeItem("userGroupId");
                }
            },
        });
    };

    useEffect(() => {
        if (dataGeneralSetup) {
            const newData = transformDataToFormValues(
                dataGeneralSetup.settings,
                dataGeneralSetup.description,
                dataGeneralSetup.is_active,
            );
            setGeneralSetup(newData);
        }
    }, [dataGeneralSetup]);

    return (
        <DashboardSectionCard title={"app.title.generalSetup"}>
            <GeneralSetupForm data={generalSetup} dataHandler={handleGeneralSetupUpdate} isSending={isPending} />
        </DashboardSectionCard>
    );
};

export default GeneralSetupUpdate;

import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import MailAccountsForm from "./components/MailAccountsForm";
import { genericView } from "../../services/genericView";
import { MAIL_ACCOUNTS_SERVICE } from "../../utils/URL";
import { formatDataBeforePost, formatMailAccountFormData, initialValues } from "./helpers";
import { GeneralLoader } from "@kace/ui-shared";
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard";
import useMailAccountsMutation from "./hooks/useMailAccountsMutation";

export const MailAccountsUpdateHandler = () => {
    const [mailAccounts, setMailAccounts] = useState(initialValues);
    const { id } = useParams();
    const { data, isLoading } = useQuery({
        queryKey: ["mailAccountsForm", id],
        queryFn: async () => genericView(`${MAIL_ACCOUNTS_SERVICE}/${id}`),
        enabled: !!id,
    });

    const { mutate, isPending } = useMailAccountsMutation();

    const handleMailAccounts = async (values) => {
        const { id } = values;
        const url = id ? `${MAIL_ACCOUNTS_SERVICE}/${id}` : `${MAIL_ACCOUNTS_SERVICE}`;
        values.vault = false;
        const dataPost = formatDataBeforePost(values, id);
        const data = { id, url, dataPost };
        mutate(data);
    };

    useEffect(() => {
        if (data) {
            setMailAccounts(formatMailAccountFormData(data));
        }
    }, [data]);

    return (
        <DashboardSectionCard title={"app.title.mailAccounts"}>
            {isLoading ? (
                <GeneralLoader />
            ) : (
                <MailAccountsForm
                    dataHandler={handleMailAccounts}
                    data={mailAccounts}
                    isSending={isLoading || isPending}
                />
            )}
        </DashboardSectionCard>
    );
};

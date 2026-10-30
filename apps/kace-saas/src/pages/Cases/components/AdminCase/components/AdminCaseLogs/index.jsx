import { useParams } from "react-router-dom";
import SummarizedView from "./components/SummarizedView";
import { useTranslation } from "react-i18next";
import SectionForm from "@/components/core/Cards/section-form";
import PropTypes from "prop-types";

const AdminCaseLogs = ({ casesData, allowedEventTypes }) => {
    const { t } = useTranslation();
    const { caseId } = useParams();

    return (
        <SectionForm className="min-h-0 min-w-0 flex w-full flex-1 flex-col overflow-auto">
            {!caseId ? (
                <h1>{t("event_logs.noCase")}</h1>
            ) : (
                <SummarizedView caseId={caseId} casesData={casesData} allowedEventTypes={allowedEventTypes} />
            )}
        </SectionForm>
    );
};

AdminCaseLogs.propTypes = {
    casesData: PropTypes.object,
    allowedEventTypes: PropTypes.array,
};

export default AdminCaseLogs;

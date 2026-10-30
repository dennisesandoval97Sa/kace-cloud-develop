import { Tabs, TabsContent, TabsList, TabsTrigger } from "@kace/ui-shared";
import { useTranslation } from "react-i18next";
import { TABS_CONSTANT_MASSIVE_EXECUTION } from "../data/constants";
import MassiveExecutionCasesFilterForm from "./MassiveExecutionCasesFilterForm";
import MassiveExecutionCasesFileUploadForm from "./MassiveExecutionCasesFileUploadForm";
import MassiveExecutionClientsFileUploadForm from "./MassiveExecutionClientsFileUploadForm";
import PropTypes from "prop-types";
import MassiveExecutionClientTab from "./MassiveExecutionClientTab";

const MassiveExecutionTabs = ({ setFilters, setPreviewType }) => {
    const { t } = useTranslation();

    return (
        <Tabs defaultValue="clients" className="w-full flex flex-col justify-center items-center">
            <TabsList className="flex flex-col w-full h-full md:inline-flex md:flex-row md:w-auto md:h-10">
                {TABS_CONSTANT_MASSIVE_EXECUTION.map(({ id, labelKey, value, icon }) => (
                    <TabsTrigger
                        key={id}
                        value={value}
                        className="w-full md:w-auto"
                        id={`massive_execution_tabs_${value}`}
                        data-testid={`massive_execution_tabs_${value}`}
                        aria-label={t(labelKey)}
                        onClick={() => setPreviewType(value)}
                    >
                        {icon} {t(labelKey)}
                    </TabsTrigger>
                ))}
            </TabsList>
            <TabsContent className="w-full" value="clients">
                <MassiveExecutionClientTab setFilters={setFilters} />
            </TabsContent>
            <TabsContent className="w-full" value="filter">
                <MassiveExecutionCasesFilterForm />
            </TabsContent>
            <TabsContent className="w-full" value="file">
                <MassiveExecutionCasesFileUploadForm />
            </TabsContent>
            <TabsContent className="w-full" value="file_clients">
                <MassiveExecutionClientsFileUploadForm />
            </TabsContent>
        </Tabs>
    );
};

MassiveExecutionTabs.propTypes = {
    setFilters: PropTypes.func,
    setPreviewType: PropTypes.func,
};

export default MassiveExecutionTabs;

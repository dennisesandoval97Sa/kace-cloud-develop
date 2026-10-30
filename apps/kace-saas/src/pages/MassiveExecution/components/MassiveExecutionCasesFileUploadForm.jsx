import { Button, KField, SelectForm } from "@kace/ui-shared";
import { useTranslation } from "react-i18next";
import useMassiveExecutionCasesForm from "../hooks/useMassiveExecutionCasesForm";
import { useEffect, useState } from "react";
import useMassiveExecutionCasesTable from "../hooks/useMassiveExecutionCasesTable";
import useMassiveExecutionClientsForm from "../hooks/useMassiveExecutionClientsFileForm";
import AttachmentContainer from "../../../components/core/Attachment/AttachmentContainer";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";
import { GeneralLoader } from "../../../components/ui-shared/src/components/general-loader";
import { joiFormikAdapter } from "@/utils/src/joiFormikAdapter";
import { UploadFileSchemaForm } from "@/schemas/MassiveExecutionSchema";
import { Form, Formik } from "formik";
import InputCard from "@/components/core/Cards/InputCard";

const MassiveExecutionCasesFileUploadForm = () => {
    const { t } = useTranslation();
    const [isProcessingFile, setIsProcessingFile] = useState(false);
    const { handleFilterCases, handleExecutionActions, handleClearCasesFilter, isPendingCases } =
        useMassiveExecutionCasesForm();
    const { handleClearClientsFilter } = useMassiveExecutionClientsForm();
    const { dataTable } = useMassiveExecutionCasesTable();

    useEffect(() => {
        handleClearCasesFilter();
        handleClearClientsFilter();
    }, []);

    return (
        <div>
            {isPendingCases ? (
                <GeneralLoader />
            ) : (
                <>
                    <Formik
                        initialValues={{ file: null, delimiter: "" }}
                        validationSchema={joiFormikAdapter(UploadFileSchemaForm)}
                        onSubmit={(values) => handleFilterCases(values)}
                    >
                        {({ setFieldValue }) => (
                            <Form className="xl:px-10" autoComplete="off">
                                <div className="flex flex-col justify-center items-center gap-2 py-4">
                                    <div className="max-w-[550px] w-full">
                                        <AttachmentContainer
                                            keyService={URL_AND_KEYS.actionJobs.s3Url}
                                            handleFiles={(value) => setFieldValue("file", value)}
                                            allowedFileTypes={["csv"]}
                                            data-testid="massive_cases_file_upload"
                                            id="massive_cases_file_upload"
                                            onProcessingChange={setIsProcessingFile}
                                            ignoreTenantExtensions
                                        />
                                    </div>
                                    <InputCard>
                                        <KField>
                                            <SelectForm
                                                placeholder={t("massiveExecution.form.labels.delimiter")}
                                                name="delimiter"
                                                options={[
                                                    {
                                                        label: `${t("massiveExecution.form.options.comma")} (,)`,
                                                        value: ",",
                                                    },
                                                    {
                                                        label: `${t("massiveExecution.form.options.semicolon")} (;)`,
                                                        value: ";",
                                                    },
                                                ]}
                                                label={t("massiveExecution.form.labels.delimiter")}
                                                className="min-w-96"
                                            />
                                        </KField>
                                    </InputCard>
                                </div>
                                <div className="flex w-full justify-end">
                                    {!dataTable.length && (
                                        <Button
                                            type="submit"
                                            id="massive_cases_upload_submit"
                                            data-testid="massive_cases_upload_submit"
                                            disabled={isProcessingFile}
                                        >
                                            {t("massiveExecution.button.uploadCases")}
                                        </Button>
                                    )}
                                </div>
                            </Form>
                        )}
                    </Formik>
                    {!!dataTable.length && (
                        <div className="flex w-full justify-between">
                            <Button
                                variant="destructive"
                                id="btn_massive_cases_cancel"
                                data-testid="btn_massive_cases_cancel"
                                onClick={handleClearCasesFilter}
                            >
                                {t("button.cancel")}
                            </Button>
                            <Button
                                onClick={() => handleExecutionActions()}
                                id="btn_massive_cases_execute"
                                data-testid="btn_massive_cases_execute"
                            >
                                {t("button.executeActions")}
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default MassiveExecutionCasesFileUploadForm;

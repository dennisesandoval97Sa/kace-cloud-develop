import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@kace/ui-shared";
import PropTypes from "prop-types";
import { Separator } from "../../../components/ui-shared";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { parseGeneralErrors } from "@/utils/parseImportErrors";

export const SheetErrors = ({ errorsDetails = null, file = "" }) => {
    const { generalErrors = [], insertErrors = [] } = errorsDetails ?? {};
    const { t } = useTranslation();

    const parsedGeneralErrors = useMemo(() => {
        const validErrors = generalErrors.filter(Boolean);
        return validErrors.flatMap((item) => parseGeneralErrors(item));
    }, [generalErrors]);

    return (
        <Sheet>
            <SheetTrigger className="text-redCustom">{t("importExport.form.seeErrors")}</SheetTrigger>
            <SheetContent className="overflow-auto space-y-4">
                <SheetHeader>
                    <SheetTitle>{t("importExport.form.errorDetails")}</SheetTitle>
                    <SheetDescription>
                        <p>
                            {t("importExport.form.file")}:{" "}
                            <strong className="text-purpleCustom">{(file ?? "").split("/").pop()}</strong>
                        </p>
                    </SheetDescription>
                </SheetHeader>
                {parsedGeneralErrors.length > 0 && (
                    <div className="space-y-2">
                        <h2>
                            <b>{t("importExport.form.generalErrors")}</b>
                        </h2>
                        {parsedGeneralErrors.map(({ row, errors }, idx) => (
                            <div key={idx} className="border border-input rounded-md overflow-hidden">
                                {row && (
                                    <div className="bg-red-50 dark:bg-red-950 px-3 py-1 border-b border-input">
                                        <span className="text-sm font-semibold text-redCustom">Fila {row}</span>
                                    </div>
                                )}
                                <ul className="p-2 space-y-1">
                                    {errors.map((err, i) => (
                                        <li key={i} className="text-sm flex gap-2">
                                            <span className="text-redCustom mt-0.5">•</span>
                                            <span>{err}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                )}
                {insertErrors.length > 0 && (
                    <div>
                        <h2>
                            <b>{t("importExport.form.errorsDataInsertion")}</b>
                        </h2>
                        {insertErrors?.map((item) => (
                            <div key={item.id_record} className="border border-input flex flex-col mb-2 p-2 rounded-md">
                                <p className="text-sm">
                                    <strong>{t("importExport.form.registerId")}</strong> {item.id_record}
                                    <br />
                                    <strong>{t("importExport.form.detail")}</strong>{" "}
                                    {item.error_detail !== null ? item.error_detail.toString() : "N/A"}
                                </p>
                                <Separator className="bg-gray-400 my-2" />
                                <p className="text-sm text-redCustom">{item.detail}</p>
                            </div>
                        ))}
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
};

SheetErrors.propTypes = {
    errorsDetails: PropTypes.object,
    file: PropTypes.string,
};

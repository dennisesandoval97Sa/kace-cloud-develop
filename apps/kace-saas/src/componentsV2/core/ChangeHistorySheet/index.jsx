import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { History, X } from "lucide-react";
import { Button, cn, GeneralLoader, LoaderThreeDots } from "@/components/ui-shared";
import * as Dialog from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import useChangeHistory from "./hooks/useChangeHistory";
import { useInView } from "react-intersection-observer";
import ChangeHistorySheeError from "./components/ChangeHistorySheeError";
import ChangeHistorySheetTimeline from "./components/ChangeHistorySheetTimeline";

const ChangeHistorySheet = ({ side = "right", entityId = undefined }) => {
    const { t } = useTranslation();
    const { ref, inView } = useInView();
    const { historyData, refetch, debouncedOnFetch, hasNextPage, isFetchingNextPage, status } =
        useChangeHistory(entityId);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (open) {
            refetch();
        }
    }, [open, refetch]);

    useEffect(() => {
        if (inView && hasNextPage && !isFetchingNextPage) {
            debouncedOnFetch();
        }
    }, [inView, hasNextPage, isFetchingNextPage, debouncedOnFetch]);

    return (
        <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
                <Button
                    size="icon"
                    type="button"
                    id="change_history_trigger_button"
                    data-testid="change_history_trigger_button"
                    aria-label={t("app.title.historyChanges")}
                >
                    <History />
                </Button>
            </Dialog.Trigger>
            <Dialog.Portal>
                <Dialog.Overlay
                    className="fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
                    id="change_history_overlay"
                    data-testid="change_history_overlay"
                />
                <Dialog.Content
                    id="change_history_sheet"
                    data-testid="change_history_sheet"
                    aria-describedby={undefined}
                    className={cn("fixed z-50 bg-white shadow-xl transition-all duration-300 ease-in-out", {
                        "bottom-0 right-0 h-full w-full md:w-[30rem]": side === "right",
                        "top-0 left-0 h-full w-96": side === "left",
                        "top-0 left-0 w-full h-1/2": side === "top",
                        "bottom-0 left-0 w-full h-1/2": side === "bottom",
                    })}
                >
                    <div
                        className="flex justify-between items-center p-4 border-b"
                        id="change_history_header"
                        data-testid="change_history_header"
                    >
                        <Dialog.Title data-testid="change_history_title" className="text-lg font-semibold">
                            {t("app.title.historyChanges")}{" "}
                        </Dialog.Title>
                        <Dialog.Close
                            className="cursor-pointer"
                            id="change_history_close"
                            data-testid="change_history_close"
                            aria-label={t("button.close")}
                        >
                            <X className="h-4 w-4" aria-hidden="true" />
                        </Dialog.Close>
                    </div>
                    <div
                        className="p-4 flex-1 overflow-x-auto h-[calc(100vh-5rem)]"
                        id="change_history_content"
                        data-testid="change_history_content"
                    >
                        {status === "pending" && (
                            <GeneralLoader id="change_history_loader" data-testid="change_history_loader" />
                        )}
                        {status === "error" && (
                            <ChangeHistorySheeError
                                handle={refetch}
                                id="change_history_error"
                                data-testid="change_history_error"
                            />
                        )}

                        <ChangeHistorySheetTimeline
                            data={historyData}
                            id="change_history_timeline"
                            data-testid="change_history_timeline"
                        />

                        <div ref={ref} className="py-4">
                            {isFetchingNextPage && (
                                <div
                                    className="w-full flex justify-center"
                                    id="change_history_loader_more"
                                    data-testid="change_history_loader_more"
                                >
                                    <LoaderThreeDots />
                                </div>
                            )}
                        </div>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

ChangeHistorySheet.propTypes = {
    side: PropTypes.string,
    entityId: PropTypes.string,
};

export default ChangeHistorySheet;

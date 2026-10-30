import React, { useState } from "react";
import PropTypes from "prop-types";
import { Button } from "@/components/ui-shared";
import { SearchCode, X } from "lucide-react";
import useConfigAgentData from "@/hooks/useConfigAgentData";
import { Dialog, Portal } from "@radix-ui/react-dialog";
import DialogOverlay from "@kace_v2/shared/ui/atoms/DialogOverlay";
import DialogContent from "@kace_v2/shared/ui/atoms/DialogContent";
import DialogClose from "@kace_v2/shared/ui/atoms/DialogClose";
import DialogTitle from "@kace_v2/shared/ui/atoms/DialogTitle";
import DialogDescription from "@kace_v2/shared/ui/atoms/DialogDescription";
import { FormOneScript } from "@/components/core/FormOneScript/FormOneScript";
import useOneScript from "@kace_v2/shared/hooks/useOneScript";
import { useTranslation } from "react-i18next";

const AdvancedSearchOneScriptContent = ({ oneScriptId, setOpen }) => {
    const { oneScriptRef, oneScriptURL } = useOneScript(oneScriptId, {});

    if (!oneScriptURL) return null;

    return <FormOneScript formRef={oneScriptRef} url={oneScriptURL} handlerCloseModal={() => setOpen(false)} />;
};

AdvancedSearchOneScriptContent.propTypes = {
    oneScriptId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    setOpen: PropTypes.func.isRequired,
};

const AdvancedSearch = ({ isAgent = false }) => {
    const { t } = useTranslation();
    const { cases: configCases } = useConfigAgentData();
    const [open, setOpen] = useState(false);
    const oneScriptId =
        configCases?.advanced_cases_search && isAgent ? configCases?.advanced_cases_search_one_script_form : null;

    if (!configCases?.advanced_cases_search || !isAgent) return null;

    return (
        <div className="shrink-0">
            <Button
                type="button"
                aria-label={t("app.title.advanced_search")}
                className="flex shrink-0 items-center justify-center gap-2 max-xl:h-10 max-xl:w-10 max-xl:gap-0 max-xl:px-0 xl:px-4"
                onClick={() => setOpen(true)}
            >
                <SearchCode className="h-4 w-4 shrink-0" />
                <span className="hidden xl:flex">{t("app.title.advanced_search")}</span>
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <Portal>
                    <DialogOverlay />
                    <DialogContent className="flex max-h-[100vh] flex-col gap-2 overflow-hidden sm:w-[calc(100vw-1rem)] sm:max-w-[calc(100vw-1rem)] sm:h-[calc(100vh-1rem)] max-[1200px]:w-[calc(100vw-1.5rem)] max-[1200px]:max-w-[calc(100vw-1.5rem)] max-[1200px]:h-[calc(100vh-1.5rem)] max-[1200px]:gap-1 xl:w-[calc(100vw-8rem)] xl:max-w-[calc(100vw-8rem)] xl:h-[calc(100vh-6rem)]">
                        <DialogClose>
                            <Button size="icon" variant="outline">
                                <X className="h-4 w-4" />
                            </Button>
                        </DialogClose>
                        <DialogTitle>{t("app.title.advanced_search")}</DialogTitle>
                        <DialogDescription>{t("app.text.advanced_search")}</DialogDescription>
                        <div className="relative h-[calc(100vh-20rem)] min-h-0 flex-1 overflow-hidden max-[1200px]:h-auto">
                            {open && <AdvancedSearchOneScriptContent oneScriptId={oneScriptId} setOpen={setOpen} />}
                        </div>
                    </DialogContent>
                </Portal>
            </Dialog>
        </div>
    );
};

AdvancedSearch.propTypes = {
    isAgent: PropTypes.bool,
};

export default AdvancedSearch;

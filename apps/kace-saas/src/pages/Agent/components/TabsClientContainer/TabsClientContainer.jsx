import { Button } from "@kace/ui-shared";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAgentContext } from "../../context/AgentContext";
import { AuxClientTab } from "./components/AuxClientTab";
import { ClientForm } from "./components/ClientForm/ClientForm";

export const TabsClientContainer = () => {
    const { t } = useTranslation();
    const { configAgent } = useAgentContext();
    const { clients } = configAgent || {};
    const [open, setOpen] = useState(false);

    const handleAcordion = () => {
        setOpen(!open);
    };

    return (
        <div className="">
            {!clients?.hide_client_form && (
                <div className={"rounded-md block"}>
                    <ClientForm />
                </div>
            )}

            {clients?.custom_form_id !== "" &&
                (clients?.show_aux_client_expanded ? (
                    <div className="rounded-md mt-2 ">
                        <AuxClientTab />
                    </div>
                ) : (
                    <>
                        <Button
                            onClick={handleAcordion}
                            type="button"
                            className="bg-white px-4 py-2 hover:bg-white/90 h-10 flex gap-1 text-black mt-2 mb-2"
                        >
                            {t("agent.title.auxClient")}
                            {open ? <ChevronUp height={18} width={18} /> : <ChevronDown height={18} width={18} />}
                        </Button>
                        {open && (
                            <div className="rounded-md h-full">
                                <AuxClientTab />
                            </div>
                        )}
                    </>
                ))}
        </div>
    );
};

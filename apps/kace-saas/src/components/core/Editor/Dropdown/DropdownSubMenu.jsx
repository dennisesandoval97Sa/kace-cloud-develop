import {
    DropdownMenuItem,
    DropdownMenuSubContent,
    DropdownMenuPortal,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
} from "@kace/ui-shared";
import { useQuery } from "@tanstack/react-query";
import PropTypes from "prop-types";
import { useMemo, useState } from "react";
import { genericView } from "../../../../services/genericView";
import { ScrollArea } from "@/components/ui-shared";
import { useTranslation } from "react-i18next";
import useAuxiliariesOptions from "@/hooks/useAuxiliariesOptions";
import { formatTestId } from "../../../../utils/src/helpers";
import { DropdownSearch } from "./DropdownSearch";

export const DropdownSubMenu = ({ text = "", schema = "", url = "", handleSelectChange }) => {
    const { t } = useTranslation();
    const isAux = url?.startsWith("aux_");
    const { auxiliariesRules } = useAuxiliariesOptions(false);
    const [query, setQuery] = useState("");

    const { data: baseData = [] } = useQuery({
        queryKey: ["listEditor", text, url],
        queryFn: () => genericView(`schema-fields/${url}`),
        enabled: !isAux,
        refetchOnWindowFocus: false,
        staleTime: 1000 * 60 * 60,
    });

    const auxData = useMemo(() => {
        if (!isAux) return [];
        const entry = auxiliariesRules?.find((r) => r.dataOrigin === schema);
        return entry?.options?.map((o) => ({ column_name: o.value })) ?? [];
    }, [isAux, auxiliariesRules, schema]);

    const rows = isAux ? auxData : baseData;

    const options = useMemo(
        () =>
            (rows ?? []).map((field) => ({
                label: field.column_name,
                value: field.column_name,
            })),
        [rows],
    );

    const visibleOptions = useMemo(() => {
        const sorted = [...options].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
        const q = query.trim().toLowerCase();
        if (!q) return sorted;
        return sorted.filter((opt) => opt.label.toLowerCase().includes(q));
    }, [options, query]);

    return (
        <DropdownMenuSub>
            <DropdownMenuSubTrigger
                id={formatTestId("subMenuTrigger", `${text}`)}
                data-testid={formatTestId("subMenuTrigger", `${text}`)}
            >
                <span>{t(`app.title.${text}`, text)}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
                <DropdownMenuSubContent
                    className="h-96 min-w-60 overflow-x-hidden"
                    data-testid={formatTestId("subMenuContent", `${text}`)}
                    id={formatTestId("subMenuContent", `${text}`)}
                >
                    <DropdownSearch value={query} onChange={setQuery} />
                    <ScrollArea className="w-full h-full">
                        {visibleOptions.length === 0 ? (
                            <div
                                className="px-3 py-4 text-sm text-muted-foreground"
                                data-testid={formatTestId("subMenuEmpty", `${text}`)}
                            >
                                {t("app.dropdown.noResults")}
                            </div>
                        ) : (
                            visibleOptions.map((option) => (
                                <DropdownMenuItem
                                    key={option.value}
                                    onClick={() => {
                                        handleSelectChange(`${schema.toLowerCase()}.${option.value}`);
                                    }}
                                    id={formatTestId("subMenuOption", `${text}_${option.value}`)}
                                    data-testid={formatTestId("subMenuOption", `${text}_${option.value}`)}
                                >
                                    <span>{option.label}</span>
                                </DropdownMenuItem>
                            ))
                        )}
                    </ScrollArea>
                </DropdownMenuSubContent>
            </DropdownMenuPortal>
        </DropdownMenuSub>
    );
};

DropdownSubMenu.propTypes = {
    text: PropTypes.string.isRequired,
    schema: PropTypes.string.isRequired,
    url: PropTypes.string.isRequired,
    handleSelectChange: PropTypes.func.isRequired,
};

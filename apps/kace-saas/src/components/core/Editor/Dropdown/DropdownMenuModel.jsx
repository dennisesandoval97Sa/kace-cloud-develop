import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    Button,
} from "@kace/ui-shared";
import { DropdownSubMenu } from "./DropdownSubMenu";
import { PropTypes } from "prop-types";
import { DEFAULT_FIELDS_OPTIONS } from "../constants";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { DropdownSearch } from "./DropdownSearch";

export const DropdownMenuModel = ({ handleSelectChange }) => {
    const { t } = useTranslation();
    const [query, setQuery] = useState("");

    const visibleModels = useMemo(() => {
        const sorted = [...DEFAULT_FIELDS_OPTIONS].sort((a, b) =>
            a.text.localeCompare(b.text, undefined, { sensitivity: "base" }),
        );
        const q = query.trim().toLowerCase();
        if (!q) return sorted;
        return sorted.filter((m) => m.text.toLowerCase().includes(q));
    }, [query]);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" id="dropdown_menu_model_fields" data-testid="dropdown_menu_model_fields">
                    {t("app.button.fields")}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                className="w-56"
                id="dropdown_menu_model_content"
                data-testid="dropdown_menu_model_content"
            >
                <DropdownMenuLabel id="dropdown_menu_model_field" data-testid="dropdown_menu_model_field">
                    {t("app.text.modelFields")}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownSearch value={query} onChange={setQuery} />
                <DropdownMenuGroup id="dropdown_menu_model_group" data-testid="dropdown_menu_model_group">
                    {visibleModels.length === 0 ? (
                        <div
                            className="px-3 py-2 text-sm text-muted-foreground"
                            data-testid="dropdown_menu_model_empty"
                        >
                            {t("app.dropdown.noResults")}
                        </div>
                    ) : (
                        visibleModels.map(({ text, schema, url }) => (
                            <DropdownSubMenu
                                key={text}
                                text={text}
                                schema={schema}
                                url={url}
                                handleSelectChange={handleSelectChange}
                            />
                        ))
                    )}
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

DropdownMenuModel.propTypes = {
    handleSelectChange: PropTypes.func.isRequired,
};

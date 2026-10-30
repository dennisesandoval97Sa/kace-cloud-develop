import { CommandInput } from "../ui/command";
import { CheckAllIcon } from "../../icons";
import { Button } from "../ui/button";
import { Search } from "lucide-react";
import { useState } from "react";

export const ButtonsAction = ({
    handleSelectAll,
    textSearch = "Search...",
    handleSearchChange,
    followInput = false,
    hideSelectAll = false,
    hideSearchButton = false,
}) => {
    const [query, setQuery] = useState("");

    const handleSetQuery = (value) => {
        if (!value || followInput || hideSearchButton) handleSearchChange(value ?? "");
        if (value) setQuery(value);
    };
    return (
        <div className="flex gap-2 items-center p-2">
            <div className="w-full">
                <CommandInput
                    onValueChange={handleSetQuery}
                    placeholder={textSearch}
                    data-testid="input_search"
                    id="input_search"
                />
            </div>
            <div className="flex gap-2 mr-2">
                {!hideSelectAll && (
                    <Button
                        size="icon"
                        type="button"
                        variant="outline"
                        onClick={handleSelectAll}
                        data-testid="btn_select_all"
                        id="btn_select_all"
                    >
                        <CheckAllIcon width={22} height={22} />
                    </Button>
                )}
            </div>
            {!hideSearchButton && (
                <Button
                    className="w-10 h-10 p-2"
                    type="button"
                    data-testid="btn_search"
                    id="btn_search"
                    onClick={() => handleSearchChange(query)}
                >
                    <Search />
                </Button>
            )}
        </div>
    );
};

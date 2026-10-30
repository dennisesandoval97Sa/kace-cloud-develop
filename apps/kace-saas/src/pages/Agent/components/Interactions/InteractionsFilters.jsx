import { Checkbox, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kace/ui-shared";
import { Search } from "lucide-react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import { INTERACTION_TYPE_FILTERS } from "./interactionTypeFilters";

export const INTERACTION_SEARCH_DEBOUNCE_MS = 500;

export const MyReviewsFilter = ({ myReviewsOnly, onMyReviewsOnlyChange, className = "" }) => {
    const { t } = useTranslation();

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <Checkbox
                id="agent-interactions-my-reviews"
                checked={myReviewsOnly}
                onCheckedChange={(checked) => onMyReviewsOnlyChange(checked === true)}
                className="border-gray-300 focus-visible:ring-purple-500 data-[state=checked]:border-purple-600 data-[state=checked]:bg-purple-600 data-[state=checked]:text-white"
            />
            <label htmlFor="agent-interactions-my-reviews" className="text-sm font-medium">
                {t("agent.interactions.filters.myReviews")}
            </label>
        </div>
    );
};

const InteractionsFilters = ({ selectedType, onTypeChange, myReviewsOnly, searchTerm, onSearchChange }) => {
    const { t } = useTranslation();
    const searchDebounceTimeoutRef = useRef(null);
    const onSearchChangeRef = useRef(onSearchChange);
    const [draftSearchTerm, setDraftSearchTerm] = useState(searchTerm);

    const cancelPendingSearchCommit = () => {
        if (searchDebounceTimeoutRef.current !== null) {
            clearTimeout(searchDebounceTimeoutRef.current);
            searchDebounceTimeoutRef.current = null;
        }
    };

    useEffect(() => {
        onSearchChangeRef.current = onSearchChange;
    }, [onSearchChange]);

    useEffect(() => {
        cancelPendingSearchCommit();
        setDraftSearchTerm(searchTerm);
    }, [searchTerm]);

    useEffect(() => () => cancelPendingSearchCommit(), []);

    const handleSearchInputChange = (event) => {
        const value = event.target.value;

        setDraftSearchTerm(value);
        cancelPendingSearchCommit();

        if (value === "") {
            onSearchChangeRef.current("");
            return;
        }

        searchDebounceTimeoutRef.current = setTimeout(() => {
            searchDebounceTimeoutRef.current = null;
            onSearchChangeRef.current(value);
        }, INTERACTION_SEARCH_DEBOUNCE_MS);
    };

    return (
        <div className="flex gap-4 items-end">
            <div className="w-64">
                <Select value={selectedType} onValueChange={onTypeChange} disabled={myReviewsOnly}>
                    <SelectTrigger
                        className="w-full"
                        aria-label={t("interactions.title.selectType")}
                        id="agent-interactions-status-filter"
                    >
                        <SelectValue placeholder={t("interactions.title.selectType")} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={INTERACTION_TYPE_FILTERS.OPEN}>{t("interactions.filters.open")}</SelectItem>
                        <SelectItem value={INTERACTION_TYPE_FILTERS.CLOSED}>
                            {t("interactions.filters.closed")}
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="flex-1">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        value={draftSearchTerm}
                        onChange={handleSearchInputChange}
                        placeholder={t("interactions.title.searchPlaceholder")}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                </div>
            </div>
        </div>
    );
};

MyReviewsFilter.propTypes = {
    myReviewsOnly: PropTypes.bool.isRequired,
    onMyReviewsOnlyChange: PropTypes.func.isRequired,
    className: PropTypes.string,
};

InteractionsFilters.propTypes = {
    selectedType: PropTypes.string.isRequired,
    onTypeChange: PropTypes.func.isRequired,
    myReviewsOnly: PropTypes.bool.isRequired,
    searchTerm: PropTypes.string.isRequired,
    onSearchChange: PropTypes.func.isRequired,
};

export default InteractionsFilters;

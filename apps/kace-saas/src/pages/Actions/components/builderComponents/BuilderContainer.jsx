import { QueryBuilder, defaultOperators } from "react-querybuilder";
import { QueryBuilderDnD } from "@react-querybuilder/dnd";
// SONAR: este es el import que se utiliza para que esta libreria sea funcional (se consulto la documentacion de la libreria)
import * as ReactDnD from "react-dnd";
// SONAR: este es el import que se utiliza para que esta libreria sea funcional (se consulto la documentacion de la libreria)
import * as ReactDndHtml5Backend from "react-dnd-html5-backend";
import "react-querybuilder/dist/query-builder.css";
import "./style/BuilderStyle.css";
import { PropTypes } from "prop-types";
import { BuilderComponents } from "./BuilderComponents";
import { useCallback } from "react";

const OPERATORS_WITH_EMPTY = [
    ...defaultOperators,
    { name: "isEmpty", value: "isEmpty", label: "isEmpty" },
    { name: "isNotEmpty", value: "isNotEmpty", label: "isNotEmpty" },
];

export const BuilderContainer = ({ setFieldValue, value = {} }) => {
    const handleChangeBuilder = useCallback(
        (query) => {
            if (!query) {
                return;
            }

            const normalizeRules = (rules = []) =>
                rules.map((r) => {
                    if (r.rules) {
                        return { ...r, rules: normalizeRules(r.rules) };
                    }
                    if (r.value && typeof r.value === "object" && r.value.type) {
                        return { ...r, type: r.value.type, value: r.value.value, value_type: r.value.value_type };
                    }
                    return r;
                });

            const normalized = { ...query, rules: normalizeRules(query.rules || []) };
            setFieldValue(normalized);
        },
        [setFieldValue],
    );

    const defaultQuery = {
        combinator: "and",
        rules: [],
    };

    return (
        <div className="space-y-2 flex flex-col" id="query_builder_container" data-testid="query_builder_container">
            <QueryBuilderDnD dnd={{ ...ReactDnD, ...ReactDndHtml5Backend }}>
                <QueryBuilder
                    fields={[]}
                    key="query-builder"
                    query={value || defaultQuery}
                    onQueryChange={handleChangeBuilder}
                    operators={OPERATORS_WITH_EMPTY}
                    controlClassnames={{ queryBuilder: "queryBuilder-branches" }}
                    controlElements={BuilderComponents}
                />
            </QueryBuilderDnD>
        </div>
    );
};

BuilderContainer.propTypes = {
    setFieldValue: PropTypes.func.isRequired,
    value: PropTypes.object,
};

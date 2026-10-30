import React, { useState } from "react";
import PropTypes from "prop-types";
import { QueryBuilder, formatQuery } from "react-querybuilder";
import Button from "@kace_v2/shared/ui/atoms/Button";
import { Code } from "lucide-react";
import * as ReactDnD from "react-dnd";
import * as ReactDndHtml5Backend from "react-dnd-html5-backend";
import { QueryBuilderDnD } from "@react-querybuilder/dnd";
import { cn } from "@kace_v2/shared/utils/cn.util";
import { FILTER_BUILDER } from "@kace_v2/shared/constants/filter-builder.constants";

const operators = Object.entries(FILTER_BUILDER.OPERATORS).map(([name, label]) => ({
    label,
    name,
}));

const QueryBuilderContent = ({ className, ...props }) => {
    const [showSQL, setShowSQL] = useState(false);

    const sqlOutput = formatQuery(props.query, "sql");

    return (
        <div className={cn("flex flex-col gap-4 rounded-xl bg-card shadow-sm", className)}>
            <QueryBuilderDnD dnd={{ ...ReactDnD, ...ReactDndHtml5Backend }}>
                <QueryBuilder
                    operators={operators}
                    controlClassnames={{
                        queryBuilder: "bg-background rounded-md border border-input space-y-4",
                        ruleGroup: "border border-blueCustom rounded-lg p-5 bg-muted/40",
                        header: "flex items-center gap-3 mb-4",
                        body: "space-y-4",
                        combinators:
                            "px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors",
                        addRule:
                            "px-4 py-2 rounded-lg bg-secondary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex justify-center items-center gap-3 h-9",
                        addGroup:
                            "px-4 py-2 rounded-lg bg-secondary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex justify-center items-center gap-3 h-9",
                        removeGroup:
                            "px-3 py-1.5 border bg-destructive border-destructive/50 text-primary-foreground rounded-lg hover:bg-destructive/10 text-sm transition-colors h-9 w-9",
                        rule: "flex flex-wrap items-center gap-3 p-4 rounded-lg bg-background/60 border border-border/50",
                        fields: "px-4 py-2 rounded-lg border border-input bg-background text-sm min-w-[200px] focus:ring-2 focus:ring-ring",
                        operators:
                            "px-4 py-2 rounded-lg border border-input bg-background text-sm min-w-[120px] focus:ring-2 focus:ring-ring",
                        value: "px-4 py-2 rounded-lg border border-input bg-background text-sm min-w-[150px] focus:ring-2 focus:ring-ring",
                        removeRule:
                            "px-3 py-1.5 border bg-destructive border-destructive/50 text-primary-foreground rounded-lg hover:bg-destructive/10 text-sm transition-colors h-9 w-9",
                    }}
                    translations={{
                        addRule: { label: "+ Agregar regla" },
                        addGroup: { label: "+ Agregar grupo" },
                        removeRule: { label: "×" },
                        combinators: {
                            title: "Combinador",
                        },
                        fields: {
                            title: "Campo",
                            placeholderName: "~",
                            placeholderLabel: "~",
                            placeholderGroupLabel: "~",
                        },
                        operators: {
                            title: "Operador",
                            placeholderName: "~",
                            placeholderLabel: "~",
                            placeholderGroupLabel: "~",
                        },
                        value: {
                            title: "Valor",
                        },
                        felipe: {
                            title: "Felipe",
                            placeholderName: "~",
                            placeholderLabel: "~",
                            placeholderGroupLabel: "~",
                        },
                    }}
                    {...props}
                />
            </QueryBuilderDnD>

            <div className="p-6 border-t border-border/50">
                <Button onClick={() => setShowSQL(!showSQL)} variant="outline" size="sm">
                    <Code className="h-4 w-4 mr-2" />
                    {showSQL ? "Ocultar" : "Ver"} SQL
                </Button>
                {showSQL && (
                    <pre className="mt-4 p-4 bg-muted/50 rounded-lg text-sm overflow-x-auto border border-border/50">
                        <code>{sqlOutput}</code>
                    </pre>
                )}
            </div>
        </div>
    );
};

QueryBuilderContent.propTypes = {
    className: PropTypes.string,
    fields: PropTypes.arrayOf(
        PropTypes.shape({
            name: PropTypes.string.isRequired,
            label: PropTypes.string.isRequired,
            placeholder: PropTypes.string.isRequired,
        }),
    ),
    query: PropTypes.string,
};

export default QueryBuilderContent;

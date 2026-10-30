import React, { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import SelectField from "@kace_v2/shared/ui/molecules/SelectField";
import useBoardsRelations from "@kace_v2/features/boards/hooks/useBoardsRelations.hook";
import FieldWrapper from "@kace_v2/shared/ui/molecules/FieldWrapper";
import { cn } from "@kace_v2/shared/utils/cn.util";
import { useFormikContext } from "formik";

const BoardsRelationEntity = ({ entity = "", entityAlias = "", level = 1 }) => {
    const { data: relations, relationshipsOptions } = useBoardsRelations(entity);
    const { values, errors, setFieldValue } = useFormikContext();

    const [joinCondition, setJoinCondition] = useState("");
    const [joinType, setJoinType] = useState("");

    const parseRelation = useCallback((relation, primaryEntity = null, joinType) => {
        if (relation) {
            const primary_entity = primaryEntity || relation.entity;
            const [leftEntity, leftColumn] = relation.join_condition.left.split(".");
            const [rightEntity, rightColumn] = relation.join_condition.right.split(".");
            return {
                primary_entity,
                related_entity: relation.relation,
                alias: relation.alias,
                join_type: joinType,
                on: [
                    {
                        left: `${primary_entity}.${leftColumn}`,
                        operator: relation.join_condition.operator,
                        right: `${relation.alias}.${rightColumn}`,
                        type: "and",
                    },
                ],
            };
        }
        return null;
    }, []);

    const entityOptions = useMemo(() => {
        if (!Array.isArray(relations) || !relations.length) return [];
        return relations.map((relation) => ({
            label: relation.alias,
            value: relation.alias,
        }));
    }, [relations]);

    const childrenEntity = useMemo(() => {
        if (joinCondition && Array.isArray(relations) && relations.length) {
            const foundRelation = relations.find((relation) => relation.alias === joinCondition);
            if (foundRelation?.relation) {
                return foundRelation.relation;
            }
        }
        return null;
    }, [joinCondition, relations]);

    const { joinTypeName, joinConditionName } = useMemo(() => ({
        joinTypeName: `join_type_level_${level}`,
        joinConditionName: `join_condition_level_${level}`,
    }), [level]);

    useEffect(() => {
        const existingJoin = values[joinConditionName];

        if (existingJoin?.join_type && !joinType) {
            setJoinType(existingJoin.join_type);
        }

        if (existingJoin?.alias && !joinCondition) {
            setJoinCondition(existingJoin.alias);
        }
    }, [values, joinConditionName, joinTypeName]);

    if (!entityOptions.length) return null;

    return (
        <div className="flex flex-col gap-3">
            <FieldWrapper
                className={cn("flex flex-col border rounded-md p-3 gap-3", {
                    "border-red-500": errors[joinConditionName] || errors[joinTypeName],
                })}
                label={`Nivel ${level}`}
                error={errors[joinConditionName] || errors[joinTypeName] || ""}
            >
                <SelectField
                    label="Tipo union"
                    name={joinTypeName}
                    value={joinType}
                    defaultValue={values[joinTypeName] || ""}
                    error={errors[joinTypeName] || ""}
                    placeholder="Seleccione..."
                    options={relationshipsOptions}
                    onValueChange={(value) => {
                        setJoinType(value);
                        setFieldValue(`${joinConditionName}.join_type`, value);
                    }}
                />
                { joinType &&
                    <SelectField
                        label="Condición de unión"
                        name={joinConditionName}
                        value={joinCondition}
                        defaultValue={values[joinConditionName] || ""}
                        error={errors[joinConditionName] || ""}
                        placeholder="Seleccione..."
                        options={entityOptions}
                        onValueChange={(value) => {
                            setJoinCondition(value);
                            if (relations && Array.isArray(relations) && relations.length) {
                                const foundRelation = relations.find((relation) => relation.alias === value);
                                const relationsData = parseRelation(foundRelation, entityAlias, joinType);
                                setFieldValue(joinConditionName, relationsData);
                            }
                        }}
                    />
                }
            </FieldWrapper>
            {
                childrenEntity && (<BoardsRelationEntity entity={childrenEntity} entityAlias={joinCondition} level={level + 1}/>)
            }
        </div>
    );
};

BoardsRelationEntity.propTypes = {
    entity: PropTypes.string,
    entityAlias: PropTypes.string,
    level: PropTypes.number,
};

export default BoardsRelationEntity;

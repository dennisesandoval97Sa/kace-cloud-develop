import React, { useEffect, useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui-shared';
import { useTranslation } from 'react-i18next';

function findFunctionInGroups(groupsObj, name) {
    if (!groupsObj || !name) return null;
    for (const key of Object.keys(groupsObj)) {
        const arr = groupsObj[key] || [];
        const found = arr.find((f) => f.name === name);
        if (found) return found;
    }
    return null;
}

const CalculatedFieldFunctions = ({ data, initialValue, onSelect, functionsData = {}, placeholder = 'Select function' }) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const groups = data ?? functionsData ?? null;
    const [selected, setSelected] = useState(null);

    const orderedGroupKeys = useMemo(() => (groups ? Object.keys(groups) : []), [groups]);

    useEffect(() => {
        if (!initialValue) return;
        if (typeof initialValue === 'string') {
            const found = findFunctionInGroups(groups, initialValue);
            if (found) setSelected(found);
            else setSelected({ name: initialValue });
        } else if (typeof initialValue === 'object') {
            setSelected(initialValue);
        }
    }, [initialValue, groups]);
    
    function handleSelect(fn) {
        setSelected(fn);
        setOpen(false);
        if (onSelect) onSelect(fn);
    }

    return (
        <div className="w-full max-w-2xl mx-auto">
            <div>
                <label htmlFor="functions-toggle" className="text-sm font-medium text-slate-700">
                    {t("auxSchema.form.function")}
                </label>
                <button
                    id="functions-toggle"
                    type="button"
                    onClick={() => setOpen(true)}
                    className="flex items-center gap-2 p-2 min-h-[40px] w-full rounded-md border border-slate-300 bg-white text-sm cursor-pointer transition-colors focus:ring-2 focus:ring-blue-500"
                >
                    <span className="text-slate-700">{selected ? selected.name : placeholder}</span>
                </button>
            </div>

            <CommandDialog open={open} onOpenChange={setOpen}>
                <CommandInput placeholder="Search functions..." />
                <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>
                    {orderedGroupKeys.map((groupKey) => (
                        <CommandGroup key={groupKey} heading={groupKey}>
                            {(groups[groupKey] || []).map((fn) => (
                                <CommandItem
                                    key={fn.name}
                                    value={fn.name}
                                    onSelect={() => handleSelect(fn)}
                                    className="flex items-center justify-between"
                                >
                                    <div>
                                        <div className="font-medium">{fn.name}</div>
                                        {fn.params && <div className="text-xs text-slate-500">{fn.params.map(p => `${p.name}:${p.type}`).join(', ')}</div>}
                                    </div>
                                    {selected && selected.name === fn.name && <div className="h-2 w-2 bg-blue-500 rounded-full" />}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    ))}
                </CommandList>
            </CommandDialog>
        </div>
    );
};

CalculatedFieldFunctions.propTypes = {
    data: PropTypes.object,
    initialValue: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    onSelect: PropTypes.func.isRequired,
    placeholder: PropTypes.string,
    functionsData: PropTypes.object.isRequired,
};

export default CalculatedFieldFunctions;

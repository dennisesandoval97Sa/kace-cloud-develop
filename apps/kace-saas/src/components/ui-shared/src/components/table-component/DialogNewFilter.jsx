import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import PropTypes from "prop-types";

export function DialogNewFilter({ open, save, setOpen, existingNames = [] }) {
    const { t } = useTranslation();
    const [name, setName] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        if (open) {
            setName("");
            setError("");
        }
    }, [open]);

    const validateName = (value) => {
        const trimmed = value.trim();
        if (trimmed.length < 3 || trimmed.length > 30) {
            return t("app.text.filterNameLength");
        }
        const exists = existingNames.some((existing) => existing.toLowerCase() === trimmed.toLowerCase());
        if (exists) {
            return t("app.text.filterNameExists");
        }
        return "";
    };

    const handleName = (value) => {
        setName(value);
        setError(validateName(value));
    };

    const canSave = name.trim().length > 0 && !error;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{t("app.text.newFilter")}</DialogTitle>
                    <DialogDescription>{t("app.text.addFilter")}</DialogDescription>
                </DialogHeader>
                <div className="flex items-center space-x-2">
                    <div className="grid flex-1 gap-2">
                        <Label htmlFor="name" className="sr-only">
                            {t("app.text.filterName")}
                        </Label>
                        <Input
                            id="name"
                            data-testid="input_name"
                            value={name}
                            onChange={(e) => handleName(e.target.value)}
                        />
                        {error ? <p className="text-redCustom">{error}</p> : null}
                    </div>
                </div>
                <DialogFooter className="sm:justify-end">
                    <DialogClose asChild>
                        <Button
                            type="button"
                            onClick={() => {
                                if (!canSave) return;
                                save(name.trim());
                                setOpen(false);
                            }}
                            disabled={!canSave}
                            id={`btn_filter_save_${name}`}
                            data-testid={`btn_filter_save_${name}`}
                        >
                            {t("app.button.save")}
                        </Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

DialogNewFilter.propTypes = {
    open: PropTypes.bool,
    save: PropTypes.func,
    setOpen: PropTypes.func,
    existingNames: PropTypes.arrayOf(PropTypes.string),
};

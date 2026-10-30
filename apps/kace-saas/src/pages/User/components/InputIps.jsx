import { Button, Input } from "@kace/ui-shared";
import { PropTypes } from "prop-types";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next"

export const InputIps = ({ allowedIps, setAllowedIps }) => {
    const [newIp, setNewIp] = useState("");
    const { t } = useTranslation()

    const isValidIp = (ip) => {
        const regex =
            /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
        return regex.test(ip);
    };

    const handleAddIp = () => {
        const ip = newIp.trim();

        if (!ip) return;

        if (!isValidIp(ip)) {
            toast.warning(t("validations.string.ip"));
            return;
        }

        if (allowedIps.includes(ip)) {
            toast.warning(t("validations.string.ip_already_listed"));
            return;
        }

        setAllowedIps((prev) => [...prev, ip]);
        setNewIp("");
    };

    return (
        <div className="flex gap-2 items-center">
            <Input
                value={newIp}
                onChange={(e) => setNewIp(e.target.value)}
                placeholder="Ej: 192.168.1.10"
                autoComplete="off"
                name="allowed_ips_input"
            />
            <Button type="button" onClick={handleAddIp}>
                {t("app.forms.add")}
            </Button>
        </div>
    );
};

InputIps.propTypes = {
    allowedIps: PropTypes.array.isRequired,
    setAllowedIps: PropTypes.func.isRequired
};

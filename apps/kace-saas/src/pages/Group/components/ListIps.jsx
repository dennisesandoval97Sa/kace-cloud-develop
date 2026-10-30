import { ScrollArea, Button, Label } from "@kace/ui-shared";
import { CircleX } from "lucide-react";
import { PropTypes } from "prop-types";
import { useTranslation } from "react-i18next"

export const ListIps = ({ allowedIps = [], setAllowedIps }) => {
    const handleDeleteIp = (ip) => {
        setAllowedIps((prev) => prev.filter((item) => item !== ip));
    };
    const { t } = useTranslation()

    return (
        <ScrollArea className="max-h-64 border border-input rounded-md p-2 mt-2">
            {allowedIps.length === 0 && (
                <p className="text-center text-gray-500 my-2">
                    {t("validations.string.ip_empty")}
                </p>
            )}

            {allowedIps.map((ip) => (
                <div
                    key={ip}
                    className="flex items-center justify-between py-1 px-2 border-b last:border-b-0"
                >
                    <Label>{ip}</Label>

                    <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteIp(ip)}
                    >
                        <CircleX />
                    </Button>
                </div>
            ))}
        </ScrollArea>
    );
};

ListIps.propTypes = {
    allowedIps: PropTypes.array.isRequired,
    setAllowedIps: PropTypes.func.isRequired
};
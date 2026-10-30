import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue
} from "../ui/select"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { Search } from "lucide-react"
import { useTranslation } from "react-i18next"

export const SearchForField = ({
    setUserValue,
    setSelectedField,
    handleSearchUser
}) => {
    const { t } = useTranslation()
    return (
        <div className="flex flex-col space-y-2" data-testid="search_for_field" id="search_for_field">
            <Input className="rounded-t-md" onChange={(e) => setUserValue(e.target.value)} data-testid="input_search_user"
                id="input_search_user" />
            <div className="flex gap-2">
                <Select onValueChange={setSelectedField}>
                    <SelectTrigger className="w-full" data-testid="select_field_trigger"
                        id="select_field_trigger">
                        <SelectValue placeholder={t("app.forms.options")} />
                    </SelectTrigger>
                    <SelectContent data-testid="select_field_options" id="select_field_options">
                        <SelectGroup>
                            <SelectLabel>{t("text.fields")}</SelectLabel>
                            <SelectItem value="nombres"
                                data-testid="select_item_name"
                                id="select_item_name"
                            >
                                {t("text.name")}
                            </SelectItem>
                            <SelectItem value="email"
                                data-testid="select_item_email"
                                id="select_item_email"
                            >
                                {t("text.email")}
                            </SelectItem>
                        </SelectGroup>
                    </SelectContent>
                </Select>
                <Button
                    className="w-10 h-10 p-2"
                    type="button"
                    onClick={handleSearchUser}
                    data-testid="btn_search_field"
                    id="btn_search_field"
                >
                    <Search />
                </Button>
            </div>
        </div>
    )
}

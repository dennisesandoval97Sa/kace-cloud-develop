import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Switch } from "./ui/switch"
import { Label } from "./ui/label"

export const Language = () => {
    const { i18n } = useTranslation()
    const [langCode, setLangCode] = useState(i18n.language)
    const handleLang = (value) => {
        const langCode = value ? "es" : "en"
        localStorage.setItem("lang_code", langCode)
        setLangCode(langCode)
        i18n.changeLanguage(langCode)
        window.location.reload()
    }
    return (
        <div className="flex items-center justify-between w-full">
            <Label htmlFor="airplane-mode">{langCode}</Label>
            <Switch id="airplane-mode" onCheckedChange={handleLang} checked={langCode === "es"} />
        </div>
    )
}

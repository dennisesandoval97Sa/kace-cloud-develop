import SectionForm from "../../../components/core/Cards/section-form"
import useDataGeolocation from "../hooks/useDataGeolocation"
import GeolocationMaps from "./GeolocationMaps"
import { GeolocationTableContainer } from "./GeolocationTableContainer"
import { SelectSingleSearch } from "../../../components/core/SelectContainer/SelectSingleSearch"

export const GeolocationContainer = () => {
    const {
        marketPosition,
        selectedUser,
        handleSelectUser,
        handleSeeGeolocation,
    } = useDataGeolocation();
    return (
        <div className="flex flex-row h-screen">
            <div className="w-[50%] pr-4">
                <div className="pb-4 space-y-1">
                    <SectionForm >
                        <SelectSingleSearch
                            name="user_id"
                            value={selectedUser}
                            setFieldValue={handleSelectUser}
                        />
                    </SectionForm>
                </div>
                <GeolocationTableContainer
                    handleSeeGeolocation={handleSeeGeolocation}
                    userId={selectedUser}
                />
            </div>
            <GeolocationMaps coordinates={marketPosition}/>
        </div>
    )
}

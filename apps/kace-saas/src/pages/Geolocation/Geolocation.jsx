import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import GeolocationHandler from "./GeolocationHandler"

const Geolocation = () => {
    return (
        <DashboardSectionCard title="app.title.geolocation">
            <GeolocationHandler />
        </DashboardSectionCard>
    )
}

export default Geolocation

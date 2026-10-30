import DefaultIndexActions from "../../components/core/DefaultIndexActions/DefaultIndexActions"
import { GeolocationContainer } from "./components/GeolocationContainer"

const GeolocationHandler = () => {

    return (
        <div className="flex flex-col gap-4">
            <DefaultIndexActions id="geolocation" nameDataTestId="geolocation" />
            <GeolocationContainer />
        </div>
    );
}

export default GeolocationHandler

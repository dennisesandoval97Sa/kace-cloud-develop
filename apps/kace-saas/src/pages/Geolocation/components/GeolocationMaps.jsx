import "maplibre-gl/dist/maplibre-gl.css";
import "@/lib/maplibre-worker";
import * as maplibregl from "maplibre-gl";
import { useEffect, useState } from "react";
import {
    AWS_LOCATION_APIKEY as apiKey,
    AWS_LOCATION_REGION as region,
    AWS_LOCATION_NAMEMAP as nameMap,
} from "../data/constans";
import { useTranslation } from "react-i18next";
import { MAP_URL } from "../../../utils/URL";

const GeolocationMaps = ({ coordinates }) => {
    const { t } = useTranslation();
    const [map, setMap] = useState(null);
    const [markers, setMarkers] = useState(null);

    useEffect(() => {
        const newMap = new maplibregl.Map({
            container: "map",
            style: MAP_URL(region, nameMap, apiKey),
            center: [-74.0954409142271, 4.660576839099842],
            zoom: 4,
        });

        newMap.addControl(new maplibregl.NavigationControl(), "top-right");
        newMap.addControl(new maplibregl.FullscreenControl(), "top-left");

        newMap.on("load", () => {
            setMap(newMap);
        });
    }, []);

    useEffect(() => {
        if (map) {
            removeMarker();
            addMarker(coordinates);
            flyToPosition(coordinates);
        }
    }, [coordinates]);

    const addMarker = (positions) => {
        if (!positions || !positions?.length) return;

        positions.forEach((position) => {
            const { longitude, latitude } = position;
            const popupContent = document.createElement("div");
            const line = (label, value) => {
                const p = document.createElement("p");
                p.textContent = `${label}: ${value}`;
                return p;
            };
            popupContent.append(
                line(t("geolocation.marker.date"), position.created_at),
                line(t("geolocation.marker.action"), position.action_type),
                line("IP", position.ip4_address),
            );

            const marker = new maplibregl.Marker()
                .setLngLat([longitude, latitude])
                .setPopup(new maplibregl.Popup().setDOMContent(popupContent))
                .addTo(map);

            setMarkers((old) => {
                if (old) {
                    old.push(marker);
                    return old;
                }
                return [marker];
            });
        });
    };

    function flyToPosition(positions) {
        if (positions?.length > 0) {
            const bounds = new maplibregl.LngLatBounds();
            positions.forEach((position) => {
                bounds.extend([position.longitude, position.latitude]);
            });
            map.fitBounds(bounds, {
                padding: 100,
                maxZoom: 15,
            });
            return;
        }
    }

    const removeMarker = () => {
        if (markers?.length) {
            markers.forEach((marker) => {
                marker.remove();
            });
        }
    };
    return <div id="map" style={{ height: "70vh", width: "50vw", paddingLeft: "10px" }} data-testid="map" />;
};

export default GeolocationMaps;

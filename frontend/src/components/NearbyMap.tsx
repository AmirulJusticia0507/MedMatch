import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import type { HospitalRecommendation } from "../types";

interface NearbyMapProps {
  latitude: number;
  longitude: number;
  locationLabel: string;
  hospitals: HospitalRecommendation[];
  selectedHospitalId: string | null;
  onSelect: (hospital: HospitalRecommendation) => void;
}

type MappableHospital = HospitalRecommendation & { latitude: number; longitude: number };

function MapViewport({ latitude, longitude, hospitals }: { latitude: number; longitude: number; hospitals: MappableHospital[] }) {
  const map = useMap();

  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  useEffect(() => {
    const points = [
      L.latLng(latitude, longitude),
      ...hospitals.map((hospital) => L.latLng(hospital.latitude, hospital.longitude))
    ];

    if (points.length === 1) {
      map.setView(points[0], 12);
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [34, 34], maxZoom: 14 });
    }
  }, [hospitals, latitude, longitude, map]);

  return null;
}

export default function NearbyMap({ latitude, longitude, locationLabel, hospitals, selectedHospitalId, onSelect }: NearbyMapProps) {
  const mappableHospitals = useMemo(() => hospitals.filter((hospital): hospital is MappableHospital =>
    Number.isFinite(hospital.latitude) && Number.isFinite(hospital.longitude)), [hospitals]);
  const patientIcon = useMemo(() => L.divIcon({
    className: "map-pin-wrapper",
    html: '<span class="map-pin map-pin--patient"><i></i></span>',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  }), []);

  return (
    <MapContainer center={[latitude, longitude]} zoom={12} className="nearby-map" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapViewport latitude={latitude} longitude={longitude} hospitals={mappableHospitals} />
      <Marker position={[latitude, longitude]} icon={patientIcon} zIndexOffset={1000}>
        <Popup><strong>Lokasi pasien</strong><br />{locationLabel}</Popup>
      </Marker>
      {mappableHospitals.map((hospital, index) => {
        const selected = hospital.hospitalId === selectedHospitalId;
        const icon = L.divIcon({
          className: "map-pin-wrapper",
          html: `<span class="map-pin map-pin--hospital${selected ? " is-selected" : ""}">${index + 1}</span>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        return (
          <Marker
            key={hospital.hospitalId}
            position={[hospital.latitude, hospital.longitude]}
            icon={icon}
            eventHandlers={{ click: () => onSelect(hospital) }}
          >
            <Popup>
              <strong>{hospital.hospitalName}</strong><br />
              {hospital.address}<br />
              {hospital.distanceKm.toFixed(1)} km dari pasien
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

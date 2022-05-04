import 'mapbox-gl/dist/mapbox-gl.css';

import { Box } from '@chakra-ui/react';
import mapboxgl, { Map, Marker } from 'mapbox-gl';
import React, { useEffect, useRef } from 'react';

import { useGetPlaces } from '../../../hooks/rq/useGetPlaces';
import { useGeolocation } from '../../../providers/GeoProvider';
import { MapboxClickEvent } from '../../../types/mapbox';

export const MapboxMap = () => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<Map | null>(null);

  const {
    latLng: { lat, lng },
    setPosition,
  } = useGeolocation();

  useGetPlaces({ lat, lng });

  // as map entity runs outside react state content, we add a variable to store markers in component scope
  let m: Marker;

  const handleMapClick = (e: MapboxClickEvent) => {
    if (m) m.remove();
    const {
      lngLat: { lat, lng },
      target,
    } = e;
    const newMarker = new Marker().setLngLat([lng, lat]);
    setPosition({
      coords: {
        latitude: lat,
        longitude: lng,
        heading: null,
        altitude: null,
        altitudeAccuracy: null,
        accuracy: 0,
        speed: null,
      },
      timestamp: Date.now(),
    });
    m = newMarker;
    m.addTo(target);
  };

  mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

  useEffect(() => {
    if (!map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current!,
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [lng, lat],
        zoom: 12,
      });
      const mapEntity = map.current!;
      m = new Marker().setLngLat([lng, lat]).addTo(mapEntity);
      mapEntity.on('click', (e: MapboxClickEvent) => handleMapClick(e));
    }
  });

  return (
    <div id="map">
      <Box width="400px" height="400px" ref={mapContainer} className="map-container" />
    </div>
  );
};

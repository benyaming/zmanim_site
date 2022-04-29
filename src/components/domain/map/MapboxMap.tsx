import 'mapbox-gl/dist/mapbox-gl.css';

import { Box } from '@chakra-ui/react';
import mapboxgl, { Marker } from 'mapbox-gl';
import React, { useEffect, useRef } from 'react';

import { useGeolocation } from '../../../providers/GeoProvider';

export const MapboxMap = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);

  const { position } = useGeolocation();
  const { coords } = position!;
  mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;
  useEffect(() => {
    if (map.current) return;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    map.current = new mapboxgl.Map({
      container: mapContainer.current!,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [coords.longitude, coords.latitude],
      zoom: 12,
    });
    new Marker().setLngLat([coords.longitude, coords.latitude]).addTo(map.current!);
  });

  return (
    <div id="map">
      <Box width="400px" height="400px" ref={mapContainer} className="map-container" />
    </div>
  );
};

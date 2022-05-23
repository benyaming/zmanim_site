import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';

import { Box } from '@chakra-ui/react';
import MapboxGeocoder, { GeocoderOptions, Result } from '@mapbox/mapbox-gl-geocoder';
import React, { useState } from 'react';
import Map, {
  FullscreenControl,
  GeolocateControl,
  MapLayerMouseEvent,
  Marker,
  NavigationControl,
  ScaleControl,
  useControl,
} from 'react-map-gl';

import { useGetPlaces } from '../../../hooks/rq/useGetPlaces';
import { useGeolocation } from '../../../providers/GeoProvider';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export interface GeocoderProps {
  onResult: (e: Result) => void;
}

const Geocoder = (props: GeocoderProps) => {
  const { onResult } = props;
  useControl<MapboxGeocoder>(() => {
    const control = new MapboxGeocoder({
      marker: false,
      accessToken: MAPBOX_TOKEN,
    });
    control.on('result', (evt) => onResult(evt.result));
    return control;
  });
  return null;
};

export const MapboxMap = () => {
  const {
    latLng: { lat, lng },
    setPosition,
  } = useGeolocation();

  useGetPlaces({ lat, lng });

  const [viewport] = useState({
    latitude: lat,
    longitude: lng,
    zoom: 10,
  });
  const handleClick = (e: MapLayerMouseEvent) => {
    const {
      lngLat: { lat, lng },
    } = e;
    setPosition({
      coords: {
        latitude: lat,
        longitude: lng,
        heading: 0,
        speed: 0,
        accuracy: 0,
        altitudeAccuracy: 0,
        altitude: 0,
      },
      timestamp: Date.now(),
    });
  };

  const handleResult = (e: Result) => {
    const [lng, lat] = e.center;
    setPosition({
      coords: {
        latitude: lat,
        longitude: lng,
        heading: 0,
        speed: 0,
        accuracy: 0,
        altitudeAccuracy: 0,
        altitude: 0,
      },
      timestamp: Date.now(),
    });
  };

  return (
    <Box height="400px" id="map">
      <Map
        onClick={handleClick}
        initialViewState={{ ...viewport }}
        mapStyle="mapbox://styles/mapbox/streets-v9"
        mapboxAccessToken={MAPBOX_TOKEN}
      >
        <Geocoder onResult={handleResult} />
        <Marker longitude={lng} latitude={lat} />
        <GeolocateControl position="top-left" />
        <FullscreenControl position="top-left" />
        <NavigationControl position="top-left" />
        <ScaleControl />
      </Map>
    </Box>
  );
};

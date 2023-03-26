import ts, { Moment } from '@mapbox/timespace';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

import { Coords } from '../types/geo';

export interface GeoProviderContextProps {
  position: GeolocationPosition | null;
  latLng: Coords;
  isLoading: boolean;
  zone: Moment | null;
  error?: string;
  setPosition: (pos: GeolocationPosition) => void;
}

const GeoContext = createContext<GeoProviderContextProps>({
  position: null,
  isLoading: true,
  zone: null,
  latLng: { lat: 31.778821, lng: 35.225259 },
  setPosition: () => {},
});

export const useGeolocation = (): GeoProviderContextProps => useContext(GeoContext);

const GeoProvider = (props: { children: ReactNode }) => {
  const { children } = props;
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [zone, setZone] = useState<Moment | null>(null);

  console.log(position);
  const handleSuccess = (position: GeolocationPosition) => {
    setPosition(position);
    setIsLoading(false);
  };
  const handleError = (error: GeolocationPositionError) => {
    console.error(error.message);
    setError(error.message);
    setIsLoading(false);
  };

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported.');
      setIsLoading(false);
    }
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError);
    if (position) {
      setZone(ts.getFuzzyLocalTimeFromPoint(Date.now(), [position.coords.latitude, position.coords.longitude]));
    }
  }, []);

  const latLng = position
    ? { lng: position?.coords.longitude, lat: position?.coords.latitude }
    : { lat: 31.778821, lng: 35.225259 };

  return (
    <GeoContext.Provider value={{ setPosition, latLng, position, error, isLoading, zone }}>
      {children}
    </GeoContext.Provider>
  );
};

export { GeoContext, GeoProvider };

import ts, { MomentTimezone } from '@mapbox/timespace';
import React, { createContext, useContext, useEffect, useState } from 'react';

export interface GeoProviderContextProps {
  position: GeolocationPosition | null;
  isLoading: boolean;
  zone: MomentTimezone | null;
  error?: string;
}

const GeoContext = createContext<GeoProviderContextProps>({
  position: null,
  isLoading: true,
  zone: null,
});

export const useGeolocation = (): GeoProviderContextProps => useContext(GeoContext);

const GeoProvider: React.FC = (props): JSX.Element => {
  const { children } = props;
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [zone, setZone] = useState<MomentTimezone | null>(null);

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
  }, [position]);

  return <GeoContext.Provider value={{ position, error, isLoading, zone }}>{children}</GeoContext.Provider>;
};

export { GeoContext, GeoProvider };

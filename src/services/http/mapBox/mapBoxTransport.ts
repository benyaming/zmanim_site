import axios from 'axios';

const mapBoxTransport = axios.create({
  baseURL: import.meta.env.VITE_MAPBOX_API_URL,
});

mapBoxTransport.interceptors.request.use((config) => {
  return config;
});

export { mapBoxTransport };

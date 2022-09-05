import { holidays } from '../constants/zmanim';

export const getSignificantDay = (index: number) => {
  if (index < 0) return false;
  return holidays[index];
};

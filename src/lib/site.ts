/** Canonical site origin. Set NEXT_PUBLIC_SITE_URL in production for correct SEO URLs. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export const SITE_NAME = 'Zmanim';

/** Build a deep link into the interactive app centered on a location. */
export function appLink(lat: number, lng: number, label: string): string {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng), label });
  return `/?${params.toString()}`;
}

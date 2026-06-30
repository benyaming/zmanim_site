import { networkInterfaces } from 'node:os';
import type { NetworkInterfaceInfo } from 'node:os';

import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// The dev server is served on 0.0.0.0 so it's reachable over the LAN (e.g. from
// a phone). Next blocks cross-origin dev requests unless the origin is
// allowlisted, which used to break every time the machine's LAN IP changed
// (new network). Auto-detect this machine's current LAN IPv4 addresses so it
// just works on any network — plus broad private ranges as a fallback.
function localDevOrigins(): string[] {
  const ips = Object.values(networkInterfaces())
    .flat()
    .filter((i): i is NetworkInterfaceInfo => !!i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
  return [...new Set([...ips, '192.168.*.*', '10.*.*.*', '172.*.*.*'])];
}

const nextConfig: NextConfig = {
  // Produce a self-contained server bundle (.next/standalone) for a minimal
  // Docker image — see Dockerfile.
  output: 'standalone',
  allowedDevOrigins: localDevOrigins(),
  // Hide the floating Next.js dev-tools badge in the corner (dev only).
  devIndicators: false,
};

export default withNextIntl(nextConfig);

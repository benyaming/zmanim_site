import { createNavigation } from 'next-intl/navigation';

import { routing } from './routing';

/** Locale-aware navigation primitives (use these instead of next/link & next/navigation). */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);

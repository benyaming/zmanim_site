'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode, SVGProps } from 'react';

const TELEGRAM_URL = 'https://t.me/benyomin';
const FACEBOOK_URL = 'https://www.facebook.com/benyomin.94';
const GITHUB_URL = 'https://github.com/benyaming';
const REPO_URL = 'https://github.com/benyaming/zmanim_site';

function SocialLink({ href, label, children }: { href: string; label: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="hover:text-foreground inline-flex items-center transition-colors"
    >
      {children}
    </a>
  );
}

/** Separator between footer segments. */
function Dot() {
  return (
    <span aria-hidden className="text-muted-foreground/40">
      |
    </span>
  );
}

// Brand glyphs — lucide-react dropped its brand icons, so these are inline
// simple-icons paths (24×24, currentColor) sized to match the footer text.
function TelegramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-3.5" {...props}>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function FacebookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-3.5" {...props}>
      <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.628-5.373-12-12-12s-12 5.372-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />
    </svg>
  );
}

function GithubIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-3.5" {...props}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.91 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

export function SiteFooter() {
  const t = useTranslations('footer');
  return (
    <footer className="text-muted-foreground shrink-0 border-t py-2.5 text-center text-[0.6875rem] leading-tight">
      <div className="mx-auto flex max-w-[2200px] flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4">
        <span className="inline-flex items-center gap-1.5">
          <span>{t('madeBy')}</span>
          <span className="inline-flex items-center gap-1.5">
            <SocialLink href={TELEGRAM_URL} label="Telegram">
              <TelegramIcon />
            </SocialLink>
            <SocialLink href={FACEBOOK_URL} label="Facebook">
              <FacebookIcon />
            </SocialLink>
            <SocialLink href={GITHUB_URL} label="GitHub">
              <GithubIcon />
            </SocialLink>
          </span>
        </span>

        <Dot />

        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="hover:text-foreground inline-flex items-center gap-1 underline underline-offset-2"
        >
          <GithubIcon />
          {t('source')}
        </a>

        <Dot />

        <span>
          {t.rich('disclaimer', {
            link: (chunks) => (
              <a
                href="https://github.com/BehindTheMath/KosherZmanim"
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground underline underline-offset-2"
              >
                {chunks}
              </a>
            ),
          })}
        </span>
      </div>
    </footer>
  );
}

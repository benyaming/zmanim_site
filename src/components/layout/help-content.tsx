'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { formatTimeWithSeconds } from '@/lib/format';
import { HELP, type HelpGenerated, type HelpLocale, type HelpSection } from '@/lib/help';
import {
  anchorDate,
  anchorZmanim,
  EQUINOX_ANCHOR,
  EQUINOX_PAIRS,
  gapSeconds,
  SHORT_NIGHT_ANCHOR,
  SHORT_NIGHT_KEYS,
} from '@/lib/help-examples';
import { ZMANIM } from '@/lib/zmanim';

/**
 * The help document: hand-written prose from `help.ts`, with every table
 * generated from the engine itself.
 *
 * The worked examples are computed by `computeZmanim` as this renders. The
 * document explains the calculation, so its examples must be produced by the
 * calculation rather than copied into prose where they could drift.
 *
 * It renders inside a dialog (see help-menu.tsx), which is why it is a client
 * component and why the section headings start at h3 — the dialog title is the
 * document's heading. The computed times never hydrate-mismatch because a Radix
 * dialog does not mount its content until it is opened.
 */

/** A table that scrolls on its own, so the dialog body never scrolls sideways. */
function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-md border-collapse text-sm">
        <thead>
          <tr className="border-b">
            {head.map((cell, i) => (
              // Keyed by position because translated column labels are not
              // guaranteed to be unique.
              <th
                key={i}
                className={`text-muted-foreground py-2 pe-3 text-start text-xs font-medium ${i > 0 ? 'ps-3' : ''}`}
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Cell({ children, mono }: { children: ReactNode; mono?: boolean }) {
  return <td className={`py-1.5 pe-3 align-top ${mono ? 'font-mono tabular-nums' : ''}`}>{children}</td>;
}

/** Caption naming the place and date a generated table was computed for. */
function AnchorCaption({ text }: { text: string }) {
  return <p className="text-muted-foreground/80 mt-2 text-xs">{text}</p>;
}

/**
 * The degree/minute coincidence at the Jerusalem equinox: each degree opinion
 * beside the fixed-minute opinion it is nicknamed after, and the gap between
 * them. This is the evidence for the section's claim, not an illustration of it.
 */
function EquinoxAnchorTable() {
  const locale = useLocale();
  const t = useTranslations('help');
  const tName = useTranslations('zmanim.names');
  const tShita = useTranslations('zmanim.shitot');

  const keys = EQUINOX_PAIRS.flatMap((p) => [p.degrees, p.minutes]);
  const times = anchorZmanim(EQUINOX_ANCHOR, keys);
  const date = anchorDate(EQUINOX_ANCHOR).setLocale(locale);

  return (
    <>
      <Table head={[t('colZman'), t('colDegrees'), t('colMinutes'), t('colGap')]}>
        {EQUINOX_PAIRS.map((pair) => {
          const gap = gapSeconds(times.get(pair.degrees) ?? null, times.get(pair.minutes) ?? null);
          return (
            <tr key={pair.degrees} className="border-b last:border-0">
              <Cell>{tName(pair.degrees)}</Cell>
              <Cell>
                <span>{tShita(pair.degrees)}</span>
                <span className="mt-0.5 block font-mono tabular-nums">
                  {formatTimeWithSeconds(times.get(pair.degrees) ?? null, locale)}
                </span>
              </Cell>
              <Cell>
                <span>{tShita(pair.minutes)}</span>
                <span className="mt-0.5 block font-mono tabular-nums">
                  {formatTimeWithSeconds(times.get(pair.minutes) ?? null, locale)}
                </span>
              </Cell>
              <Cell mono>{gap === null ? '—' : t('seconds', { count: gap })}</Cell>
            </tr>
          );
        })}
      </Table>
      <AnchorCaption
        text={t('anchorJerusalem', {
          date: date.toLocaleString({ day: 'numeric', month: 'long', year: 'numeric' }),
        })}
      />
    </>
  );
}

/**
 * A northern midsummer morning: the degree dawns with no time at all, the
 * minute-based ones still resolving, and the seasonal dawn ahead of the fixed
 * ninety-minute one.
 */
function ShortNightTable() {
  const locale = useLocale();
  const t = useTranslations('help');
  const tShita = useTranslations('zmanim.shitot');
  const tFamily = useTranslations('zmanim.families');

  const times = anchorZmanim(SHORT_NIGHT_ANCHOR, SHORT_NIGHT_KEYS);
  const date = anchorDate(SHORT_NIGHT_ANCHOR).setLocale(locale);
  const familyOf = (key: string) => ZMANIM.find((z) => z.key === key)!.family;

  return (
    <>
      <Table head={[t('colOpinion'), t('colMethod'), t('colTime')]}>
        {SHORT_NIGHT_KEYS.map((key) => {
          const time = times.get(key) ?? null;
          return (
            <tr key={key} className="border-b last:border-0">
              <Cell>{tShita(key)}</Cell>
              <Cell>{tFamily(familyOf(key))}</Cell>
              <td className={`py-1.5 pe-3 align-top font-mono tabular-nums ${time ? '' : 'text-muted-foreground'}`}>
                {formatTimeWithSeconds(time, locale)}
              </td>
            </tr>
          );
        })}
      </Table>
      <AnchorCaption
        text={t('anchorShortNight', {
          date: date.toLocaleString({ day: 'numeric', month: 'long', year: 'numeric' }),
        })}
      />
    </>
  );
}

function Generated({ kind }: { kind: HelpGenerated }) {
  if (kind === 'equinoxAnchor') return <EquinoxAnchorTable />;
  return <ShortNightTable />;
}

function Section({ section }: { section: HelpSection }) {
  return (
    <section id={`help-${section.id}`} className="scroll-mt-2 space-y-2">
      <h3 className="text-base font-semibold tracking-tight">{section.heading}</h3>
      {section.body.map((paragraph) => (
        <p key={paragraph} className="text-muted-foreground text-sm leading-relaxed">
          {paragraph}
        </p>
      ))}
      {section.terms && (
        <dl className="bg-muted/20 divide-y rounded-lg border">
          {section.terms.map((term) => (
            <div key={term.term} className="grid gap-1 p-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
              <dt className="text-sm font-medium">{term.term}</dt>
              <dd className="text-muted-foreground text-sm leading-relaxed">{term.body}</dd>
            </div>
          ))}
        </dl>
      )}
      {section.generated && <Generated kind={section.generated} />}
    </section>
  );
}

export function HelpContent() {
  const locale = useLocale();
  const doc = HELP[locale as HelpLocale] ?? HELP.en;

  return (
    <div>
      <p className="text-sm leading-relaxed">{doc.lede}</p>
      <div className="mt-6 space-y-8">
        {doc.sections.map((section) => (
          <Section key={section.id} section={section} />
        ))}
      </div>
    </div>
  );
}

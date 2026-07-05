import type { ReactNode } from 'react';

/**
 * The one section header used everywhere in the day panel — an uppercase
 * micro-label followed by a hairline rule filling the rest of the line, like
 * the section rules of a printed luach. Daily learning and every zmanim group
 * share it, so the panel reads as sections of a single sheet rather than a
 * stack of unrelated boxes.
 */
export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h4 className="text-muted-foreground/70 mb-1.5 flex items-center gap-2 text-[0.6875rem] font-semibold tracking-[0.08em] uppercase">
      <span className="shrink-0">{children}</span>
      <span aria-hidden className="bg-border h-px flex-1" />
    </h4>
  );
}

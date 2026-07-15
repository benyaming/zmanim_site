'use client';

import { ChevronDown } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { CONFIGURABLE_ZMANIM, type ZmanCategory } from '@/lib/zmanim';

/** A base zman and its one-or-more shita keys, in definition (chronological) order. */
export interface ZmanPickerBase {
  base: string;
  keys: string[];
}

export interface ZmanPickerSection {
  category: ZmanCategory;
  bases: ZmanPickerBase[];
}

/**
 * The shared picker structure — categories → bases → shita keys — so the
 * calendar-settings visibility picker and the export column picker stay in
 * lockstep. Built once from the static CONFIGURABLE_ZMANIM.
 */
export const ZMAN_PICKER_SECTIONS: ZmanPickerSection[] = (
  ['dawn', 'morning', 'midday', 'afternoon', 'evening'] as ZmanCategory[]
)
  .map((category) => {
    const bases = new Map<string, ZmanPickerBase>();
    for (const z of CONFIGURABLE_ZMANIM.filter((z) => z.category === category)) {
      const entry = bases.get(z.base) ?? { base: z.base, keys: [] };
      entry.keys.push(z.key);
      bases.set(z.base, entry);
    }
    return { category, bases: [...bases.values()] };
  })
  .filter((s) => s.bases.length > 0);

/**
 * A base zman as one control. A single-opinion base is a flat labeled checkbox;
 * a multi-opinion base collapses its shitot behind a disclosure — the header
 * carries a tri-state "toggle all" checkbox, the name, a selected/total count,
 * and a chevron, so a base with a dozen Tzeit opinions never floods the picker.
 * Collapsed by default; the count conveys state without opening it.
 *
 * Selection is caller-defined (`isSelected` / `setSelected`) so the same control
 * drives both the settings visibility picker and the export column picker.
 */
export function ZmanBaseControl({
  base,
  name,
  keys,
  shitaLabel,
  isSelected,
  setSelected,
  open,
  onToggleOpen,
  idPrefix,
  capReached = false,
}: {
  base: string;
  /** Display name of the base zman (e.g. "Tzeit ha-Kochavim"). */
  name: string;
  keys: string[];
  /** Short shita label for a key (e.g. "8.5°", "Magen Avraham · 90 min"). */
  shitaLabel: (key: string) => string;
  isSelected: (key: string) => boolean;
  setSelected: (key: string, selected: boolean) => void;
  open: boolean;
  onToggleOpen: () => void;
  /** DOM id namespace so the settings and export pickers don't collide. */
  idPrefix: string;
  /** When a selection cap is in force and reached, unchecked options are disabled. */
  capReached?: boolean;
}) {
  if (keys.length === 1) {
    const key = keys[0];
    const id = `${idPrefix}-${key}`;
    const disabled = capReached && !isSelected(key);
    return (
      <label htmlFor={id} className={cn('flex items-center gap-2', disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer')}>
        <Checkbox id={id} checked={isSelected(key)} disabled={disabled} onCheckedChange={(v) => setSelected(key, v === true)} />
        <span className="text-sm">{name}</span>
      </label>
    );
  }

  const selectedCount = keys.filter((k) => isSelected(k)).length;
  const panelId = `${idPrefix}-base-panel-${base}`;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Checkbox
          id={`${idPrefix}-base-${base}`}
          aria-label={name}
          checked={selectedCount === keys.length ? true : selectedCount === 0 ? false : 'indeterminate'}
          // At the cap, "select all" would overshoot — disable it (clearing stays allowed).
          disabled={capReached && selectedCount < keys.length}
          // Anything less than all selected → select all; fully selected → clear.
          onCheckedChange={() => {
            const selectAll = selectedCount < keys.length;
            keys.forEach((k) => setSelected(k, selectAll));
          }}
        />
        {/* The name/count is the disclosure toggle; the checkbox toggles all shitot. */}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggleOpen}
          className="flex flex-1 items-center justify-between gap-2 text-start"
        >
          <span className="text-sm">{name}</span>
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-xs tabular-nums">
              {selectedCount}/{keys.length}
            </span>
            <ChevronDown
              aria-hidden
              className={cn('text-muted-foreground size-4 transition-transform', !open && '-rotate-90 rtl:rotate-90')}
            />
          </span>
        </button>
      </div>
      {open && (
        <div id={panelId} className="space-y-1 ps-6">
          {keys.map((key) => {
            const id = `${idPrefix}-${key}`;
            const disabled = capReached && !isSelected(key);
            return (
              <label
                key={key}
                htmlFor={id}
                className={cn('flex items-center gap-2', disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer')}
              >
                <Checkbox id={id} checked={isSelected(key)} disabled={disabled} onCheckedChange={(v) => setSelected(key, v === true)} />
                <span className="text-muted-foreground text-xs">{shitaLabel(key)}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { BookmarkPlus, LoaderCircle, MapPin, Navigation, Pencil, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { makeLocation, useAppState } from '@/components/providers/app-state';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useGeolocation } from '@/hooks/use-geolocation';
import { searchCities } from '@/lib/geo/geocoding';
import { type SavedLocation, savedLocationDisplayName, savedLocationMatches } from '@/lib/saved-locations';

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/**
 * The naming form shared by "save current location" and per-entry editing.
 * Only the custom name is editable — the geocoded place and its auto-detected
 * elevation are shown as context, matching the rest of the app where
 * elevation is never hand-entered.
 */
function SavedLocationForm({
  initialName,
  geocodedLabel,
  elevation,
  onSubmit,
  onCancel,
}: {
  initialName: string;
  /** Shown as context above the field — the entry's original geocoded name. */
  geocodedLabel: string;
  elevation: number | undefined;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const t = useTranslations('location');
  const tSettings = useTranslations('settings');
  const [name, setName] = useState(initialName);

  return (
    <form
      className="bg-muted/40 mt-1.5 space-y-2 rounded-lg border p-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(name);
      }}
    >
      <p className="text-muted-foreground flex min-w-0 items-center gap-1 text-xs">
        <MapPin className="size-3 shrink-0" />
        <span className="truncate">{geocodedLabel}</span>
        {typeof elevation === 'number' && (
          <span className="shrink-0">
            · {elevation} {tSettings('meters')}
          </span>
        )}
      </p>
      <label className="block">
        <span className="text-muted-foreground mb-1 block text-xs font-medium">{t('nameLabel')}</span>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('namePlaceholder')}
          autoFocus
          maxLength={60}
        />
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button type="submit" size="sm">
          {t('save')}
        </Button>
      </div>
    </form>
  );
}

export function LocationPicker() {
  const t = useTranslations('location');
  const tSettings = useTranslations('settings');
  const locale = useLocale();
  const {
    location,
    setLocation,
    useElevation,
    savedLocations,
    addSavedLocation,
    updateSavedLocation,
    removeSavedLocation,
    selectSavedLocation,
  } = useAppState();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // Which saved entry is being edited inline; 'new' = the save-current form.
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const debouncedQuery = useDebounced(query);
  const { locating, error, locate } = useGeolocation(() => setOpen(false));

  const { data: places = [], isFetching } = useQuery({
    queryKey: ['cities', locale, debouncedQuery],
    queryFn: ({ signal }) => searchCities(debouncedQuery, signal, locale),
    enabled: debouncedQuery.trim().length >= 2,
  });

  const currentSaved = savedLocations.some((e) => savedLocationMatches(e, location));
  const headerLabel = location.customLabel ?? location.label;

  const setDialogOpen = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery('');
      setEditingId(null);
    }
  };

  const renderEntry = (entry: SavedLocation) => {
    if (editingId === entry.id) {
      return (
        <li key={entry.id}>
          <SavedLocationForm
            initialName={entry.name}
            geocodedLabel={entry.location.label}
            elevation={entry.location.elevation}
            onSubmit={(name) => {
              updateSavedLocation(entry.id, name);
              setEditingId(null);
            }}
            onCancel={() => setEditingId(null)}
          />
        </li>
      );
    }
    const display = savedLocationDisplayName(entry);
    const detailParts = [
      entry.name.trim() ? entry.location.label : null,
      typeof entry.location.elevation === 'number' ? `${entry.location.elevation} ${tSettings('meters')}` : null,
    ].filter(Boolean);
    return (
      <li key={entry.id} className="flex items-center gap-0.5">
        <button
          type="button"
          className="hover:bg-accent hover:text-accent-foreground flex min-w-0 flex-1 flex-col rounded-md px-2 py-1.5 text-start"
          onClick={() => {
            selectSavedLocation(entry.id);
            setDialogOpen(false);
          }}
        >
          <span className="w-full truncate text-sm font-medium">{display}</span>
          {detailParts.length > 0 && (
            <span className="text-muted-foreground w-full truncate text-xs">{detailParts.join(' · ')}</span>
          )}
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground size-7 shrink-0"
          aria-label={t('edit')}
          onClick={() => setEditingId(entry.id)}
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive size-7 shrink-0"
          aria-label={t('delete')}
          onClick={() => removeSavedLocation(entry.id)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </li>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        {/* `shrink min-w-0` overrides the button base's shrink-0 so a long city
            name ellipsizes instead of overflowing the header on narrow screens. */}
        {/* h-auto + min-h-8 keeps the normal pill height but lets it grow when
            the elevation wraps to a second line on narrow screens. */}
        <Button variant="outline" size="sm" className="h-auto min-h-8 min-w-0 shrink max-w-[12rem] gap-1.5 py-1">
          <MapPin className="size-4 shrink-0" />
          {/* Elevation-adjusted zmanim change the displayed times, so surface
              the elevation where the location is — only while the setting is
              on, so the default view stays uncluttered. On sm+ it sits inline
              after the name; on narrow screens it drops to a second line so
              the city name keeps the full pill width instead of ellipsizing. */}
          {useElevation && typeof location.elevation === 'number' ? (
            <span className="flex min-w-0 flex-col items-start leading-tight sm:flex-row sm:items-baseline sm:gap-1.5">
              <span className="w-full min-w-0 truncate sm:w-auto">{headerLabel}</span>
              <span className="text-muted-foreground w-full truncate text-start text-[0.625rem] font-normal sm:w-auto sm:shrink-0 sm:text-xs">
                {location.elevation} {tSettings('meters')}
              </span>
            </span>
          ) : (
            <span className="truncate">{headerLabel}</span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md lg:max-w-xl">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>{t('choose')}</DialogTitle>
          <DialogDescription>{t('hint')}</DialogDescription>
        </DialogHeader>

        <div className="px-4 pt-3">
          <Button variant="secondary" className="w-full justify-start gap-2" onClick={locate} disabled={locating}>
            {locating ? <LoaderCircle className="size-4 animate-spin" /> : <Navigation className="size-4" />}
            {t('useCurrent')}
          </Button>
          {error && <p className="text-destructive mt-2 text-sm">{error}</p>}
        </div>

        <div className="px-4 pt-3">
          {savedLocations.length > 0 && (
            <>
              <p className="text-muted-foreground text-xs font-medium">{t('savedTitle')}</p>
              <ul className="mt-1 max-h-48 space-y-0.5 overflow-y-auto">{savedLocations.map(renderEntry)}</ul>
            </>
          )}
          {editingId === 'new' ? (
            <SavedLocationForm
              initialName=""
              geocodedLabel={location.label}
              elevation={location.elevation}
              onSubmit={(name) => {
                addSavedLocation(name, location);
                setEditingId(null);
              }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            !currentSaved && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground mt-0.5 w-full justify-start gap-2 px-2"
                onClick={() => setEditingId('new')}
              >
                <BookmarkPlus className="size-4" />
                <span className="min-w-0 truncate">{t('saveCurrent', { name: location.label })}</span>
              </Button>
            )
          )}
        </div>

        <Command shouldFilter={false} className="mt-2">
          <CommandInput placeholder={t('searchPlaceholder')} value={query} onValueChange={setQuery} />
          <CommandList>
            {debouncedQuery.trim().length >= 2 && !isFetching && places.length === 0 && (
              <CommandEmpty>{t('noResults')}</CommandEmpty>
            )}
            <CommandGroup>
              {places.map((place) => (
                <CommandItem
                  key={place.id}
                  value={place.id}
                  onSelect={() => {
                    setLocation(makeLocation(place.lat, place.lng, place.name, locale, place.elevation));
                    setDialogOpen(false);
                  }}
                >
                  <MapPin className="size-4 opacity-60" />
                  <span>{place.description}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

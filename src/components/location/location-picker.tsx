'use client';

import { useQuery } from '@tanstack/react-query';
import { LoaderCircle, MapPin, Navigation } from 'lucide-react';
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
import { useGeolocation } from '@/hooks/use-geolocation';
import { searchCities } from '@/lib/geo/geocoding';

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function LocationPicker() {
  const t = useTranslations('location');
  const locale = useLocale();
  const { location, setLocation } = useAppState();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounced(query);
  const { locating, error, locate } = useGeolocation(() => setOpen(false));

  const { data: places = [], isFetching } = useQuery({
    queryKey: ['cities', locale, debouncedQuery],
    queryFn: ({ signal }) => searchCities(debouncedQuery, signal, locale),
    enabled: debouncedQuery.trim().length >= 2,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-[12rem] gap-1.5">
          <MapPin className="size-4 shrink-0" />
          <span className="truncate">{location.label}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
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
                    setLocation(makeLocation(place.lat, place.lng, place.name));
                    setOpen(false);
                    setQuery('');
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

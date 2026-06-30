'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

/**
 * Shared icon-button-plus-dialog shell for the header's settings menus
 * (Appearance / Calendar / Tools). Each menu is its own trigger button, so they
 * read as distinct entries rather than tabs inside one dialog.
 */
export function SettingsDialogShell({
  icon: Icon,
  label,
  title,
  children,
}: {
  icon: LucideIcon;
  label: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label={label}>
          <Icon className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 pt-2">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

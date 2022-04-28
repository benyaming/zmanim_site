export interface CalendarStateModel {
  readonly displayedPeriodDate: Date;
  readonly selectedDay: CalendarDayModel | null;
  readonly days: CalendarDayModel[];
  hebrewMode: boolean;
}

export interface CalendarDayModel {
  readonly date: Date;
  readonly events: any[];
}

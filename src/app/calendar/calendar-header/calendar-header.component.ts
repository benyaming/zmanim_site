import { Component } from '@angular/core';
import { Store } from '@ngxs/store';
import { NavigationDirection } from '@shared/types';
import { NavigateCalendar } from '@core/state';
import { WeekDay } from '@angular/common';
import { enumKeys } from '@shared/utils';

@Component({
  selector: 'app-calendar-header',
  templateUrl: './calendar-header.component.html',
  styleUrls: ['./calendar-header.component.scss'],
})
export class CalendarHeaderComponent {
  readonly weekDays = enumKeys(WeekDay);

  constructor(private readonly store: Store) {}

  onCalendarNavigateButtonClicked(navigationDirection: NavigationDirection) {
    this.store.dispatch(new NavigateCalendar(navigationDirection));
  }
}

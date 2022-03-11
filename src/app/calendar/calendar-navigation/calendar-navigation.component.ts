import { Component } from '@angular/core';
import { Store } from '@ngxs/store';
import { NavigationDirection } from '@shared/types';
import { NavigateCalendar } from '@core/state';

@Component({
  selector: 'app-calendar-navigation',
  templateUrl: './calendar-navigation.component.html',
  styleUrls: ['./calendar-navigation.component.scss'],
})
export class CalendarNavigationComponent {
  constructor(private readonly store: Store) {}

  onCalendarNavigateButtonClicked(navigationDirection: NavigationDirection) {
    this.store.dispatch(new NavigateCalendar(navigationDirection));
  }
}

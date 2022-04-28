import { Component, OnDestroy, OnInit } from '@angular/core';
import { Select, Store } from '@ngxs/store';
import { NavigationDirection } from '@shared/types';
import {
  CalendarState,
  CalendarStateModel,
  NavigateCalendar,
  ToggleCalendarMode,
} from '@core/state';
import { WeekDay } from '@angular/common';
import { enumKeys } from '@shared/utils';
import { Observable, Subscription } from 'rxjs';

@Component({
  selector: 'app-calendar-header',
  templateUrl: './calendar-header.component.html',
  styleUrls: ['./calendar-header.component.scss'],
})
export class CalendarHeaderComponent implements OnInit, OnDestroy {
  @Select(CalendarState)
  private readonly state$!: Observable<CalendarStateModel>;

  private readonly onDestroy$: Subscription = new Subscription();

  hebrewMode: boolean = false;

  readonly weekDays = enumKeys(WeekDay);

  constructor(private readonly store: Store) {}

  ngOnInit(): void {
    this.onDestroy$.add(
      this.state$.subscribe(({ hebrewMode }) => {
        this.hebrewMode = hebrewMode;
      }),
    );
  }

  ngOnDestroy(): void {
    this.onDestroy$.unsubscribe();
  }

  onCalendarNavigateButtonClicked(navigationDirection: NavigationDirection) {
    this.store.dispatch(new NavigateCalendar(navigationDirection));
  }

  onModeToggle() {
    this.store.dispatch(new ToggleCalendarMode());
  }
}

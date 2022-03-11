import { Component, HostBinding, OnDestroy, OnInit } from '@angular/core';
import {
  addDays,
  differenceInDays,
  differenceInWeeks,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { Select } from '@ngxs/store';
import { AppState, CalendarModel } from '@core/state';
import { Observable, Subscription } from 'rxjs';

@Component({
  selector: 'app-calendar-grid',
  templateUrl: './calendar-grid.component.html',
  styleUrls: ['./calendar-grid.component.scss'],
})
export class CalendarGridComponent implements OnInit, OnDestroy {
  days: Date[] = [];

  @HostBinding('class')
  private get classList(): string {
    return `calendar-grid--${this.weeksNumber}-weeks`;
  }

  @Select(AppState.calendar)
  private readonly calendar$!: Observable<CalendarModel>;

  private weeksNumber: number = 5; // can be from 4 to 6

  private readonly onDestroy$: Subscription = new Subscription();

  ngOnInit(): void {
    this.buildDaysGrid();
  }

  ngOnDestroy(): void {
    this.onDestroy$.unsubscribe();
  }

  private buildDaysGrid() {
    this.onDestroy$.add(
      this.calendar$.subscribe(({ displayedPeriodDate }) => {
        const startOfDisplayedMonth = startOfMonth(displayedPeriodDate);
        const endOfDisplayedMonth = endOfMonth(displayedPeriodDate);

        const startOfDisplayedPeriod = startOfWeek(startOfDisplayedMonth);
        const endOfDisplayedPeriod = endOfWeek(endOfDisplayedMonth);

        this.weeksNumber =
          differenceInWeeks(endOfDisplayedPeriod, startOfDisplayedPeriod) + 1;

        const daysNumber =
          differenceInDays(endOfDisplayedPeriod, startOfDisplayedPeriod) + 1;
        const days: Date[] = [];
        for (let i = 0; i < daysNumber; i++) {
          days.push(addDays(startOfDisplayedPeriod, i));
        }
        this.days = days;
      }),
    );
  }
}

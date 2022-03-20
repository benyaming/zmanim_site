import {
  Component,
  HostBinding,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { isSameDay, isSameMonth } from 'date-fns';
import { Select, Store } from '@ngxs/store';
import {
  CalendarDayModel,
  CalendarState,
  CalendarStateModel,
  FetchZmanim,
  SelectCalendarDay,
} from '@core/state';
import { Observable, Subscription } from 'rxjs';
import { TuiDay } from '@taiga-ui/cdk';

@Component({
  selector: 'app-calendar-day',
  templateUrl: './calendar-day.component.html',
  styleUrls: ['./calendar-day.component.scss'],
})
export class CalendarDayComponent implements OnInit, OnDestroy {
  @Select(CalendarState)
  private readonly state$!: Observable<CalendarStateModel>;

  @Input() day!: CalendarDayModel;

  @HostBinding('class.calendar-day--displayed-month')
  private isDisplayedMonth: boolean = false;

  @HostBinding('class.calendar-day--today')
  private isToday: boolean = false;

  @HostBinding('class.calendar-day--selected')
  private isSelected: boolean = false;

  private readonly onDestroy$: Subscription = new Subscription();

  constructor(private readonly store: Store) {}

  ngOnInit(): void {
    this.setTodayClassModifier();
    this.initSettingStateDependentClassModifiers();
  }

  ngOnDestroy(): void {
    this.onDestroy$.unsubscribe();
  }

  @HostListener('click')
  private onCalendarDayClicked(): void {
    const day = this.day.date.getDay();
    const month = this.day.date.getMonth();
    const year = this.day.date.getFullYear();
    this.store.dispatch(new SelectCalendarDay(this.day));
    this.store.dispatch(
      new FetchZmanim({
        date: new TuiDay(year, month, day).toLocalNativeDate(),
      }),
    );
  }

  private setTodayClassModifier(): void {
    this.isToday = isSameDay(new Date(), this.day.date);
  }

  private initSettingStateDependentClassModifiers(): void {
    this.onDestroy$.add(
      this.state$.subscribe(({ displayedPeriodDate, selectedDay }) => {
        this.isDisplayedMonth = isSameMonth(displayedPeriodDate, this.day.date);
        this.isSelected =
          !!selectedDay && isSameDay(selectedDay.date, this.day.date);
      }),
    );
  }
}

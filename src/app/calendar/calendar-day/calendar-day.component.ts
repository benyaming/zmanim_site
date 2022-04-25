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
  AppState,
  CalendarDayModel,
  CalendarState,
  CalendarStateModel,
  FetchZmanim,
  GetZmanim,
  LocationModel,
  SelectCalendarDay,
  ZmanimModel,
} from '@core/state';
import { Observable, Subscription } from 'rxjs';
import { ZmanimService } from '@core/zmanim';
import { JewishDate } from 'kosher-zmanim';

@Component({
  selector: 'app-calendar-day',
  templateUrl: './calendar-day.component.html',
  styleUrls: ['./calendar-day.component.scss'],
  providers: [ZmanimService],
})
export class CalendarDayComponent implements OnInit, OnDestroy {
  @Select(CalendarState)
  private readonly state$!: Observable<CalendarStateModel>;

  @Select(AppState.zmanim) readonly zmanim$!: Observable<ZmanimModel>;

  @Select(AppState.location) readonly location$!: Observable<LocationModel>;

  @Input() day!: CalendarDayModel;
  @Input() jewDate!: JewishDate;
  @Input() jewDay!: string;

  @HostBinding('class.calendar-day--displayed-month')
  private isDisplayedMonth: boolean = false;

  @HostBinding('class.calendar-day--today')
  private isToday: boolean = false;

  @HostBinding('class.calendar-day--selected')
  private isSelected: boolean = false;

  private readonly onDestroy$: Subscription = new Subscription();

  private formatter = new this.zmanimService.kosherZmanim.HebrewDateFormatter();
  private calendar = new this.zmanimService.kosherZmanim.ZmanimCalendar();

  constructor(
    private readonly store: Store,
    private zmanimService: ZmanimService,
  ) {}

  ngOnInit(): void {
    this.jewDate = new this.zmanimService.kosherZmanim.JewishDate(
      this.day.date,
    );
    this.jewDay = this.formatter.format(this.jewDate);
    this.setTodayClassModifier();
    this.initSettingStateDependentClassModifiers();
  }

  ngOnDestroy(): void {
    this.onDestroy$.unsubscribe();
  }

  @HostListener('click')
  private onCalendarDayClicked(): void {
    this.store.dispatch(new SelectCalendarDay(this.day));
    this.store.dispatch(new GetZmanim(this.day));
    this.store.dispatch(
      new FetchZmanim({
        date: this.day.date,
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

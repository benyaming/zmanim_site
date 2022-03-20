import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { Select, Store } from '@ngxs/store';
import {
  CalendarState,
  CalendarStateModel,
  FetchZmanim,
  GenerateCalendarDays,
  SelectCalendarDay,
} from '@core/state';
import { TuiDay } from '@taiga-ui/cdk';

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss'],
})
export class CalendarComponent implements OnInit {
  @Select(CalendarState)
  readonly state$!: Observable<CalendarStateModel>;

  constructor(private readonly store: Store) {}

  ngOnInit(): void {
    this.generateCalendarDays();
    const date = new Date();
    const day = date.getDay();
    const month = date.getMonth();
    const year = date.getFullYear();
    this.store.dispatch(
      new FetchZmanim({
        date: new TuiDay(year, month, day).toLocalNativeDate(),
      }),
    );
  }

  private generateCalendarDays() {
    this.store.dispatch(new GenerateCalendarDays());
  }
}

import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { Select, Store } from '@ngxs/store';
import {
  CalendarState,
  CalendarStateModel,
  GenerateCalendarDays,
} from '@core/state';

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
  }

  private generateCalendarDays() {
    this.store.dispatch(new GenerateCalendarDays());
  }
}

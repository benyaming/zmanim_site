import { Injectable } from '@angular/core';
import { Action, State, StateContext } from '@ngxs/store';
import {
  GenerateCalendarDays,
  NavigateCalendar,
  SelectCalendarDay,
  ToggleCalendarMode,
} from './calendar.actions';
import {
  addDays,
  addMonths,
  differenceInDays,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { CALENDAR_DEFAULTS } from './calendar.defaults';
import { CalendarDayModel, CalendarStateModel } from './calendar.models';

@State<CalendarStateModel>({
  name: 'calendar',
  defaults: CALENDAR_DEFAULTS,
})
@Injectable()
export class CalendarState {
  @Action(NavigateCalendar)
  private navigateCalendar(
    ctx: StateContext<CalendarStateModel>,
    { payload }: NavigateCalendar,
  ): void {
    const current = ctx.getState();

    ctx.patchState({
      displayedPeriodDate:
        payload === 'sub'
          ? subMonths(current.displayedPeriodDate, 1)
          : addMonths(current.displayedPeriodDate, 1),
    });

    ctx.dispatch(new GenerateCalendarDays());
  }

  @Action(SelectCalendarDay)
  private selectCalendarDay(
    ctx: StateContext<CalendarStateModel>,
    { payload }: SelectCalendarDay,
  ): void {
    ctx.patchState({
      selectedDay: payload,
    });
  }

  @Action(ToggleCalendarMode)
  private toggleCalendarModel(ctx: StateContext<CalendarStateModel>): void {
    const current = ctx.getState();
    ctx.patchState({
      hebrewMode: !current.hebrewMode,
    });
  }

  @Action(GenerateCalendarDays)
  private generateCalendarDays(ctx: StateContext<CalendarStateModel>): void {
    const current = ctx.getState();

    const startOfDisplayedMonth = startOfMonth(current.displayedPeriodDate);
    const endOfDisplayedMonth = endOfMonth(current.displayedPeriodDate);

    const startOfDisplayedPeriod = startOfWeek(startOfDisplayedMonth);
    const endOfDisplayedPeriod = endOfWeek(endOfDisplayedMonth);

    const daysNumber =
      differenceInDays(endOfDisplayedPeriod, startOfDisplayedPeriod) + 1;
    const days: CalendarDayModel[] = [];
    for (let i = 0; i < daysNumber; i++) {
      days.push({
        date: addDays(startOfDisplayedPeriod, i),
        events: [],
      });
    }

    ctx.patchState({
      days,
    });
  }
}

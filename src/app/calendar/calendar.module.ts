import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { CalendarRoutingModule } from './calendar-routing.module';
import { CalendarComponent } from './calendar.component';
import { CalendarDayComponent } from './calendar-day/calendar-day.component';
import { CalendarGridComponent } from './calendar-grid/calendar-grid.component';
import { CalendarHeaderComponent } from './calendar-header/calendar-header.component';
import { TuiButtonModule } from '@taiga-ui/core';

@NgModule({
  declarations: [
    CalendarComponent,
    CalendarDayComponent,
    CalendarGridComponent,
    CalendarHeaderComponent,
  ],
  imports: [CommonModule, CalendarRoutingModule, TuiButtonModule],
})
export class CalendarModule {}

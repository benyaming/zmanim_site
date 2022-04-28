import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { CalendarRoutingModule } from './calendar-routing.module';
import { CalendarComponent } from './calendar.component';
import { CalendarDayComponent } from './calendar-day/calendar-day.component';
import { CalendarGridComponent } from './calendar-grid/calendar-grid.component';
import { CalendarHeaderComponent } from './calendar-header/calendar-header.component';
import { TuiButtonModule } from '@taiga-ui/core';
import { ZmanimModule } from '../zmanim/zmanim.module';
import { TuiToggleModule } from '@taiga-ui/kit';

@NgModule({
  declarations: [
    CalendarComponent,
    CalendarDayComponent,
    CalendarGridComponent,
    CalendarHeaderComponent,
  ],
  imports: [
    CommonModule,
    CalendarRoutingModule,
    TuiButtonModule,
    ZmanimModule,
    TuiToggleModule,
  ],
})
export class CalendarModule {}

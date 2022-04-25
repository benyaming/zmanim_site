import { Component, HostBinding, Input } from '@angular/core';
import { CalendarDayModel } from '@core/state';

@Component({
  selector: 'app-calendar-grid',
  templateUrl: './calendar-grid.component.html',
  styleUrls: ['./calendar-grid.component.scss'],
})
export class CalendarGridComponent {
  @Input() days!: CalendarDayModel[];

  @HostBinding('class')
  private get classList(): string {
    return `calendar-grid--${this.days.length / 7}-weeks`;
  }
}

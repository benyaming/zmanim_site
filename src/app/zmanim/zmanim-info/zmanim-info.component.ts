import { Component } from '@angular/core';
import { Observable } from 'rxjs';
import { AppState, ZmanimStateModel } from '@core/state';
import { Select } from '@ngxs/store';

@Component({
  selector: 'app-zmanim-info',
  templateUrl: './zmanim-info.component.html',
  styleUrls: ['./zmanim-info.component.scss'],
})
export class ZmanimInfoComponent {
  @Select(AppState.zmanim) readonly state$!: Observable<ZmanimStateModel>;
  readonly compareWith = () => 0;
}

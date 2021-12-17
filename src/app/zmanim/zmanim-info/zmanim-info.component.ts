import {Component} from '@angular/core';
import {Observable} from 'rxjs';
import {AppStore, ZmanimInfoModel} from '@core/store';

@Component({
  selector: 'app-zmanim-info',
  templateUrl: './zmanim-info.component.html',
  styleUrls: ['./zmanim-info.component.scss']
})
export class ZmanimInfoComponent {
  zmanimInfo$: Observable<ZmanimInfoModel> = this.store.zmanimInfo$;

  constructor(
    private readonly store: AppStore
  ) {
  }

}

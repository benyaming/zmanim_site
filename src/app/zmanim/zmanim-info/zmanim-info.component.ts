import {Component} from '@angular/core';
import {Observable} from 'rxjs';
import {StoreService, ZmanimInfoModel} from '@core/store';

@Component({
  selector: 'app-zmanim-info',
  templateUrl: './zmanim-info.component.html',
  styleUrls: ['./zmanim-info.component.scss']
})
export class ZmanimInfoComponent {
  readonly zmanimInfo$: Observable<ZmanimInfoModel> = this.storeService.zmanimInfo$;

  readonly columns: string[] = ['key', 'value'];

  constructor(
    private readonly storeService: StoreService
  ) {
  }

  readonly compareWith = () => 0;
}

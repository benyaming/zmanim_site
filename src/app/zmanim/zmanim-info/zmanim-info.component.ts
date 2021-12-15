import {Component} from '@angular/core';
import {Observable} from 'rxjs';
import {ZmanimResponseDto} from '../dto/zmanim-response.dto';
import {ZmanimStore} from '../zmanim.store';

@Component({
  selector: 'app-zmanim-info',
  templateUrl: './zmanim-info.component.html',
  styleUrls: ['./zmanim-info.component.scss']
})
export class ZmanimInfoComponent {
  zmanim$: Observable<ZmanimResponseDto> = this.store.zmanim$;

  constructor(
    private readonly store: ZmanimStore
  ) {
  }

}

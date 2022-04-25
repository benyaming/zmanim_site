import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { AppState, ZmanimModel } from '@core/state';
import { Select } from '@ngxs/store';

@Component({
  selector: 'app-zmanim-info',
  templateUrl: './zmanim-info.component.html',
  styleUrls: ['./zmanim-info.component.scss'],
})
export class ZmanimInfoComponent implements OnInit {
  @Select(AppState.zmanim) readonly zmanim$!: Observable<ZmanimModel>;
  readonly compareWith = () => 0;

  ngOnInit(): void {
    console.log('zzzzz', this.zmanim$);
  }
}

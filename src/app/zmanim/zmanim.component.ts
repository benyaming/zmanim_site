import {Component, OnDestroy, OnInit} from '@angular/core';
import {ZmanimService} from './zmanim.service';
import {Subscription} from 'rxjs';
import {ZmanimStore} from './zmanim.store';
import {filter, switchMap} from 'rxjs/operators';

@Component({
  selector: 'app-zmanim',
  templateUrl: './zmanim.component.html',
  styleUrls: ['./zmanim.component.scss']
})
export class ZmanimComponent implements OnInit, OnDestroy {
  private readonly sub$: Subscription = new Subscription();

  constructor(
    private readonly service: ZmanimService,
    private readonly store: ZmanimStore
  ) {
  }

  ngOnInit(): void {
    this.initZmanimFetch();
  }

  ngOnDestroy(): void {
    this.sub$.unsubscribe();
  }

  private initZmanimFetch(): void {
    this.sub$.add(
      this.store.params$.pipe(
        filter(({date, lat, lng}) => !!(date && lat && lng)),
        switchMap(params => this.service.getZmanim(params))
      ).subscribe(zmanim => {
        this.store.setZmanim(zmanim);
      })
    );
  }
}

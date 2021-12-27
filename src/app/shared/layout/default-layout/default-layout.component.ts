import {Component, Inject, Injector, Input, OnDestroy, OnInit} from '@angular/core';
import {TuiDialogService} from '@taiga-ui/core';
import {PolymorpheusComponent} from '@tinkoff/ng-polymorpheus';
import {DefaultLayoutMapComponent} from './default-layout-map/default-layout-map.component';
import {Subscription} from 'rxjs';
import {StoreService} from '@core/store';

@Component({
  selector: 'app-default-layout',
  templateUrl: './default-layout.component.html',
  styleUrls: ['./default-layout.component.scss']
})
export class DefaultLayoutComponent implements OnInit, OnDestroy {
  cityName?: string;

  private readonly onDestroy$: Subscription = new Subscription();

  constructor(
    @Inject(TuiDialogService) private readonly dialogService: TuiDialogService,
    @Inject(Injector) private readonly injector: Injector,
    private readonly storeService: StoreService
  ) {
  }

  ngOnInit(): void {
    this.initCityName();
  }

  ngOnDestroy(): void {
    this.onDestroy$.unsubscribe();
  }

  openMap(): void {
    this.onDestroy$.add(
      this.dialogService.open(
        new PolymorpheusComponent(DefaultLayoutMapComponent, this.injector),
        {dismissible: true}
      ).subscribe()
    );
  }

  private initCityName(): void {
    this.onDestroy$.add(
      this.storeService.coords$
        .subscribe(({cityName}) => {
          this.cityName = cityName;
        })
    );
  }
}

import { Component, Inject, Injector, OnDestroy } from '@angular/core';
import { TuiDialogService } from '@taiga-ui/core';
import { PolymorpheusComponent } from '@tinkoff/ng-polymorpheus';
import { DefaultLayoutMapComponent } from './default-layout-map/default-layout-map.component';
import { Observable, Subscription } from 'rxjs';
import { Select, Store } from '@ngxs/store';
import {
  AppState,
  LocationModel,
  LocationWithoutSourceModel,
  SetLocationManually,
} from '@core/state';
import { TranslateService } from '@ngx-translate/core';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-default-layout',
  templateUrl: './default-layout.component.html',
  styleUrls: ['./default-layout.component.scss'],
})
export class DefaultLayoutComponent implements OnDestroy {
  @Select(AppState.location) location$!: Observable<LocationModel>;

  private readonly onDestroy$: Subscription = new Subscription();

  constructor(
    @Inject(TuiDialogService) private readonly dialogService: TuiDialogService,
    @Inject(Injector) private readonly injector: Injector,
    private readonly store: Store,
    private readonly translateService: TranslateService,
  ) {}

  ngOnDestroy(): void {
    this.onDestroy$.unsubscribe();
  }

  openMapDialog(): void {
    const location: LocationModel | null = this.store.selectSnapshot(
      AppState.location,
    );
    if (!location) {
      return;
    }

    this.onDestroy$.add(
      this.translateService
        .get('default-layout.map-dialog-heading')
        .pipe(
          switchMap((heading) =>
            this.dialogService.open<LocationWithoutSourceModel>(
              new PolymorpheusComponent(
                DefaultLayoutMapComponent,
                this.injector,
              ),
              {
                dismissible: true,
                data: location,
                label: heading,
              },
            ),
          ),
        )
        .subscribe((location) => {
          this.store.dispatch(new SetLocationManually(location));
        }),
    );
  }
}

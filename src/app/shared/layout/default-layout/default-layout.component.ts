import {
  Component,
  Inject,
  Injector,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { TuiDialogService, TuiHostedDropdownComponent } from '@taiga-ui/core';
import { PolymorpheusComponent } from '@tinkoff/ng-polymorpheus';
import { DefaultLayoutMapComponent } from './default-layout-map/default-layout-map.component';
import { Observable, Subscription } from 'rxjs';
import { Select, Store } from '@ngxs/store';
import { AppState, ChangeCurrentLanguage, LocationModel } from '@core/state';
import { TranslateService } from '@ngx-translate/core';
import { map, shareReplay, switchMap } from 'rxjs/operators';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';

@Component({
  selector: 'app-default-layout',
  templateUrl: './default-layout.component.html',
  styleUrls: ['./default-layout.component.scss'],
})
export class DefaultLayoutComponent implements OnDestroy {
  @Select(AppState.location) location$!: Observable<LocationModel>;
  @Select(AppState.currentLanguage) currentLanguage$!: Observable<string>;
  @Select(AppState.supportedLanguages) supportedLanguages$!: Observable<
    string[]
  >;

  @ViewChild(TuiHostedDropdownComponent)
  private readonly dropdown!: TuiHostedDropdownComponent;

  readonly isHandset$: Observable<boolean> = this.breakpointObserver
    .observe(Breakpoints.Handset)
    .pipe(
      map((result) => result.matches),
      shareReplay(),
    );

  private readonly onDestroy$: Subscription = new Subscription();

  constructor(
    @Inject(TuiDialogService) private readonly dialogService: TuiDialogService,
    @Inject(Injector) private readonly injector: Injector,
    private readonly store: Store,
    private readonly translateService: TranslateService,
    private readonly breakpointObserver: BreakpointObserver,
  ) {}

  ngOnDestroy(): void {
    this.onDestroy$.unsubscribe();
  }

  openMapDialog(): void {
    this.onDestroy$.add(
      this.translateService
        .get('default-layout.map-dialog-heading')
        .pipe(
          switchMap((label) =>
            this.dialogService.open(
              new PolymorpheusComponent(
                DefaultLayoutMapComponent,
                this.injector,
              ),
              {
                dismissible: true,
                label,
              },
            ),
          ),
        )
        .subscribe(),
    );
  }

  onChangeLanguageButtonClicked(language: string): void {
    this.store.dispatch(new ChangeCurrentLanguage(language));
    this.dropdown.open = false;
    this.dropdown.nativeFocusableElement?.focus();
  }
}

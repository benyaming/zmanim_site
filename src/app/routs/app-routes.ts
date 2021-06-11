import {Routes} from '@angular/router';

enum ROUTES {
  ZMANIM = 'zmanim'
}

export const AppRoutes: Routes = [
  {
    path: '',
    redirectTo: ROUTES.ZMANIM,
    pathMatch: 'full',
  },
];

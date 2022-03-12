import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AppRoute } from './app.route';

const routes: Routes = [
  { path: '', redirectTo: AppRoute.zmanim, pathMatch: 'full' },

  {
    path: AppRoute.zmanim,
    loadChildren: () =>
      import('./zmanim/zmanim.module').then((m) => m.ZmanimModule),
  },
  {
    path: AppRoute.converter,
    loadChildren: () =>
      import('./converter/converter.module').then((m) => m.ConverterModule),
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true })],
  exports: [RouterModule],
})
export class AppRoutingModule {}

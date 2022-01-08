import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ZmanimComponent } from './zmanim.component';

const routes: Routes = [{ path: '', component: ZmanimComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ZmanimRoutingModule {}

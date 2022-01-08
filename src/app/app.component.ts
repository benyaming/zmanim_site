import {Component, OnInit} from '@angular/core';
import {Store} from "@ngxs/store";
import {FetchLocationFromFreegeoip, FetchLocationFromNavigator} from "@core/state";


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  constructor(
    private readonly store: Store
  ) {
  }

  ngOnInit(): void {
    this.store.dispatch([
      new FetchLocationFromNavigator(),
      new FetchLocationFromFreegeoip()
    ]);
  }
}

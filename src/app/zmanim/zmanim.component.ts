import {Component, Input, OnInit} from '@angular/core';
import {Observable} from 'rxjs';
import {ZmanimResponse} from '../zmanim-api/dto/zmanim.response';

@Component({
  selector: 'app-zmanim',
  templateUrl: './zmanim.component.html',
  styleUrls: ['./zmanim.component.css']
})
export class ZmanimComponent implements OnInit {

  @Input() zmanim$: Observable<ZmanimResponse> = null;

  sunrise: string;
  alos: string;
  sof_zman_tefila_gra: string;
  sof_zman_tefila_ma: string;
  misheyakir_10_2: string;
  sof_zman_shema_gra: string;
  sof_zman_shema_ma: string;
  chatzos: string;
  mincha_ketana: string;
  mincha_gedola: string;
  plag_mincha: string;
  sunset: string;
  tzeis_8_5_degrees: string;
  tzeis_72_minutes: string;
  tzeis_42_minutes: string;
  tzeis_5_95_degrees: string;
  chatzot_laila: string;
  astronomical_hour_ma: string;
  astronomical_hour_gra: string;


  constructor() { }

  ngOnInit(): void {
    this.zmanim$.subscribe(zmanim => {
      this.sunrise = zmanim.sunrise;
      this.alos = zmanim.alos;
      this.sof_zman_tefila_gra = zmanim.sof_zman_tefila_gra;
      this.sof_zman_tefila_ma = zmanim.sof_zman_tefila_ma;
      this.misheyakir_10_2 = zmanim.misheyakir_10_2;
      this.sof_zman_shema_gra = zmanim.sof_zman_shema_gra;
      this.sof_zman_shema_ma = zmanim.sof_zman_shema_ma;
      this.chatzos = zmanim.chatzos;
      this.mincha_ketana = zmanim.mincha_ketana;
      this.mincha_gedola = zmanim.mincha_gedola;
      this.plag_mincha = zmanim.plag_mincha;
      this.sunset = zmanim.sunset;
      this.tzeis_8_5_degrees = zmanim.tzeis_8_5_degrees;
      this.tzeis_72_minutes = zmanim.tzeis_72_minutes;
      this.tzeis_42_minutes = zmanim.tzeis_42_minutes;
      this.tzeis_5_95_degrees = zmanim.tzeis_5_95_degrees;
      this.chatzot_laila = zmanim.chatzot_laila;
      this.astronomical_hour_ma = zmanim.astronomical_hour_ma;
      this.astronomical_hour_gra = zmanim.astronomical_hour_gra;
    });
  }

}

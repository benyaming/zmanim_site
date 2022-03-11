import { Component, OnInit } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { TUI_DATE_SEPARATOR } from '@taiga-ui/cdk';
import { format } from 'date-fns';
import * as KosherZmanim from 'kosher-zmanim';

export type JewGrigorian = DateVariant.jew | DateVariant.gregorian;
export enum DateVariant {
  jew = 'jew',
  gregorian = 'gregorian',
}

@Component({
  selector: 'app-zmanim-convert-form',
  templateUrl: './zmanim-convert-form.component.html',
  styleUrls: ['./zmanim-convert-form.component.scss'],
  providers: [{ provide: TUI_DATE_SEPARATOR, useValue: '.' }],
})
export class ZmanimConvertFormComponent implements OnInit {
  converter = new KosherZmanim.JewishDate();

  DateVariant = DateVariant;
  shortDateFormatter = (date: string) => `${date.padStart(2, '0')}`;

  generateFormDateValues = (name: JewGrigorian): [number, number, number] =>
    this.form
      .get(name)
      ?.value.split('.')
      .map((d: string) => parseInt(d, 10))
      .reverse();

  convertJewDateToInputValue = () => {
    const jewMonth = this.converter.getJewishMonth().toString();
    const jewDay = this.converter.getJewishDayOfMonth().toString();
    return `${this.shortDateFormatter(jewDay)}.${this.shortDateFormatter(
      jewMonth,
    )}.${this.converter.getJewishYear()}`;
  };

  convertGrigorianDateToInputValue = () => {
    const day = this.converter.getGregorianDayOfMonth().toString();
    const month = this.converter.getGregorianMonth().toString();
    return `${this.shortDateFormatter(day)}.${this.shortDateFormatter(
      month,
    )}.${this.converter.getGregorianYear()}`;
  };

  readonly form: FormGroup = new FormGroup({
    grigorian: new FormControl(format(Date.now(), 'dd.MM.yyyy')),
    jew: new FormControl(this.convertJewDateToInputValue()),
  });

  ngOnInit(): void {
    this.form.patchValue({
      grigorian: format(Date.now(), 'dd.MM.yyyy'),
      jew: this.convertJewDateToInputValue(),
    });
  }

  readonly dateMask = {
    guide: false,
    mask: [/\d/, /\d/, '.', /\d/, /\d/, '.', /\d/, /\d/, /\d/, /\d/],
  };

  field: JewGrigorian = DateVariant.gregorian;

  onChange = (name: JewGrigorian) => {
    this.field = name;
  };

  onConvert = () => {
    if (this.field === 'gregorian') {
      const values = this.generateFormDateValues(DateVariant.gregorian);
      this.converter.setGregorianDate(...values);
      this.form.patchValue({ jew: this.convertJewDateToInputValue() });
    } else {
      const values = this.generateFormDateValues(DateVariant.jew);
      this.converter.setJewishDate(...values);
      this.form.patchValue({
        grigorian: this.convertGrigorianDateToInputValue(),
      });
    }
  };
}

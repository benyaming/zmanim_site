import { Component, OnInit } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { TUI_DATE_SEPARATOR } from '@taiga-ui/cdk';
import { format } from 'date-fns';
import * as KosherZmanim from 'kosher-zmanim';

@Component({
  selector: 'app-zmanim-convert-form',
  templateUrl: './zmanim-convert-form.component.html',
  styleUrls: ['./zmanim-convert-form.component.scss'],
  providers: [{ provide: TUI_DATE_SEPARATOR, useValue: '.' }],
})
export class ZmanimConvertFormComponent implements OnInit {
  converter = new KosherZmanim.JewishDate();

  convertJewDateToInputValue = () => {
    const jewMonth = this.converter.getJewishMonth().toString();
    const jewDay = this.converter.getJewishDayOfMonth().toString();
    return `${jewDay.length > 1 ? jewDay : `0${jewDay}`}.${
      jewMonth.length > 1 ? jewMonth : `0${jewMonth}`
    }.${this.converter.getJewishYear()}`;
  };

  convertGrigorianDateToInputValue = () => {
    const day = this.converter.getGregorianDayOfMonth().toString();
    const month = this.converter.getGregorianMonth().toString();
    return `${day.length > 1 ? day : `0${day}`}.${
      month.length > 1 ? month : `0${month}`
    }.${this.converter.getGregorianYear()}`;
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

  field: 'jew' | 'grigorian' = 'grigorian';

  onChange = (name: 'jew' | 'grigorian') => {
    this.field = name;
  };

  onConvert = () => {
    if (this.field === 'grigorian') {
      const values = this.form
        .get('grigorian')
        ?.value.split('.')
        .map((d: string) => parseInt(d, 10));
      this.converter.setGregorianDate(values[2], values[1], values[0]);
      this.form.patchValue({ jew: this.convertJewDateToInputValue() });
    } else {
      const values = this.form
        .get('jew')
        ?.value.split('.')
        .map((d: string) => parseInt(d, 10));
      this.converter.setJewishDate(values[2], values[1], values[0]);
      this.form.patchValue({
        grigorian: this.convertGrigorianDateToInputValue(),
      });
    }
  };
}

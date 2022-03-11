import { Component, OnDestroy, OnInit } from '@angular/core';
import { JewishDate } from 'kosher-zmanim';
import { FormControl, FormGroup } from '@angular/forms';
import { format } from 'date-fns';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-converter',
  templateUrl: './converter.component.html',
  styleUrls: ['./converter.component.scss'],
})
export class ConverterComponent implements OnInit, OnDestroy {
  readonly form: FormGroup = new FormGroup({
    gregorian: new FormControl(format(new Date(), 'dd.MM.yyyy')),
    jewish: new FormControl(convertJewishDateToInputValue()),
  });

  readonly converter = CONVERTER;

  readonly dateMask = {
    guide: false,
    mask: [/\d/, /\d/, '.', /\d/, /\d/, '.', /\d/, /\d/, /\d/, /\d/],
  };

  private dateVariant: DateVariant = DateVariant.gregorian;

  private readonly onDestroy$: Subscription = new Subscription();

  ngOnInit(): void {
    this.initSettingDateVariant();
  }

  ngOnDestroy(): void {
    this.onDestroy$.unsubscribe();
  }

  onConvertButtonClicked(): void {
    if (this.dateVariant === DateVariant.gregorian) {
      const values = this.generateFormDateValues(DateVariant.gregorian);
      this.converter.setGregorianDate(...values);
      this.form.patchValue(
        { jewish: convertJewishDateToInputValue() },
        { emitEvent: false },
      );
    } else {
      const values = this.generateFormDateValues(DateVariant.jewish);
      this.converter.setJewishDate(...values);
      this.form.patchValue(
        { gregorian: convertGregorianDateToInputValue() },
        { emitEvent: false },
      );
    }
  }

  private initSettingDateVariant(): void {
    this.onDestroy$.add(
      this.form
        .get(DateVariant.gregorian)!
        .valueChanges.subscribe(
          () => (this.dateVariant = DateVariant.gregorian),
        ),
    );
    this.onDestroy$.add(
      this.form
        .get(DateVariant.jewish)!
        .valueChanges.subscribe(() => (this.dateVariant = DateVariant.jewish)),
    );
  }

  private generateFormDateValues(name: DateVariant): [number, number, number] {
    return this.form
      .get(name)!
      .value.split('.')
      .map((d: string) => parseInt(d, 10))
      .reverse();
  }
}

const CONVERTER = new JewishDate();

enum DateVariant {
  jewish = 'jewish',
  gregorian = 'gregorian',
}

function convertJewishDateToInputValue(): string {
  const jewMonth = CONVERTER.getJewishMonth().toString();
  const jewDay = CONVERTER.getJewishDayOfMonth().toString();
  return `${shortDateFormatter(jewDay)}.${shortDateFormatter(
    jewMonth,
  )}.${CONVERTER.getJewishYear()}`;
}

function convertGregorianDateToInputValue(): string {
  const day = CONVERTER.getGregorianDayOfMonth().toString();
  const month = CONVERTER.getGregorianMonth().toString();
  return `${shortDateFormatter(day)}.${shortDateFormatter(
    month,
  )}.${CONVERTER.getGregorianYear()}`;
}

function shortDateFormatter(date: string): string {
  return `${date.padStart(2, '0')}`;
}

import { Component, OnDestroy, OnInit } from '@angular/core';
import { JewishDate } from 'kosher-zmanim';
import { FormControl, FormGroup } from '@angular/forms';
import { Subscription } from 'rxjs';
import { TextMaskConfig } from 'angular2-text-mask';

const CONVERTER = new JewishDate();

@Component({
  selector: 'app-converter',
  templateUrl: './converter.component.html',
  styleUrls: ['./converter.component.scss'],
})
export class ConverterComponent implements OnInit, OnDestroy {
  readonly form: FormGroup = new FormGroup({
    [DateVariant.gregorian]: new FormControl(
      convertGregorianDateToInputValue(),
    ),
    [DateVariant.jewish]: new FormControl(convertJewishDateToInputValue()),
  });

  jewishDateString: string = CONVERTER.toString();

  readonly dateMask: TextMaskConfig = {
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
      CONVERTER.setGregorianDate(
        ...this.generateFormDateValues(DateVariant.gregorian),
      );
      this.form.patchValue(
        { [DateVariant.jewish]: convertJewishDateToInputValue() },
        { emitEvent: false },
      );
    } else if (this.dateVariant === DateVariant.jewish) {
      CONVERTER.setJewishDate(
        ...this.generateFormDateValues(DateVariant.jewish),
      );
      this.form.patchValue(
        { [DateVariant.gregorian]: convertGregorianDateToInputValue() },
        { emitEvent: false },
      );
    }

    this.jewishDateString = CONVERTER.toString();
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
      .map((value: string) => parseInt(value, 10))
      .reverse();
  }
}

enum DateVariant {
  jewish = 'jewish',
  gregorian = 'gregorian',
}

function convertJewishDateToInputValue(): string {
  return `${shortDateFormatter(
    CONVERTER.getJewishMonth(),
  )}.${shortDateFormatter(
    CONVERTER.getJewishDayOfMonth(),
  )}.${CONVERTER.getJewishYear()}`;
}

function convertGregorianDateToInputValue(): string {
  return `${shortDateFormatter(
    CONVERTER.getGregorianDayOfMonth(),
  )}.${shortDateFormatter(
    CONVERTER.getGregorianMonth() + 1,
  )}.${CONVERTER.getGregorianYear()}`;
}

function shortDateFormatter(date: number): string {
  return date.toString().padStart(2, '0');
}

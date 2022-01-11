import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'languageToCountry',
})
export class LanguageToCountryPipe implements PipeTransform {
  static readonly languageToCountryMap: Record<string, string> = {
    en: 'us',
    he: 'il',
    ru: 'ru',
  };

  transform(language: string): string {
    if (!LanguageToCountryPipe.languageToCountryMap[language]) {
      throw new Error(`Can't find country for the given language ${language}`);
    }
    return LanguageToCountryPipe.languageToCountryMap[language];
  }
}

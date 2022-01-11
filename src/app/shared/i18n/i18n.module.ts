import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageToCountryPipe } from './language-to-country.pipe';

@NgModule({
  declarations: [LanguageToCountryPipe],
  exports: [LanguageToCountryPipe],
  imports: [CommonModule],
})
export class I18nModule {}

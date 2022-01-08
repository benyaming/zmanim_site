import { Directive } from '@angular/core';

@Directive({
  selector: '[appDefaultLayoutForm]',
  // eslint-disable-next-line @angular-eslint/no-host-metadata-property
  host: {
    '[style.min-width]': '"200px"',
  },
})
export class DefaultLayoutFormDirective {}

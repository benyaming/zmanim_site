import {Directive} from '@angular/core';

@Directive({
  selector: '[appDefaultLayoutForm]',
  // tslint:disable-next-line:no-host-metadata-property
  host: {
    '[style.min-width]': '"200px"',
  }
})
export class DefaultLayoutFormDirective {
}

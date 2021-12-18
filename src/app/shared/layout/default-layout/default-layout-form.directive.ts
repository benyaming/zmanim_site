import {Directive} from '@angular/core';

@Directive({
  selector: '[appDefaultLayoutForm]',
  // tslint:disable-next-line:no-host-metadata-property
  host: {
    '[style.z-index]': '"2"'
  }
})
export class DefaultLayoutFormDirective {
}

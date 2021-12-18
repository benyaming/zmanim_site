import {Directive} from '@angular/core';

@Directive({
  selector: '[appDefaultLayoutInfo]',
  // tslint:disable-next-line:no-host-metadata-property
  host: {
    '[style.z-index]': '"2"',
    '[clss.tui-island__paragraph]': 'true'
  }
})
export class DefaultLayoutInfoDirective {
}

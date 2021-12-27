import {Directive} from '@angular/core';

@Directive({
  selector: '[appDefaultLayoutInfo]',
  // tslint:disable-next-line:no-host-metadata-property
  host: {
    '[style.min-width]': '"200px"',
    '[clss.tui-island__paragraph]': 'true'
  }
})
export class DefaultLayoutInfoDirective {
}

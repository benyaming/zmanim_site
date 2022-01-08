import {Directive} from '@angular/core';

@Directive({
  selector: '[appDefaultLayoutInfo]',
  // eslint-disable-next-line @angular-eslint/no-host-metadata-property
  host: {
    '[style.min-width]': '"200px"',
    '[clss.tui-island__paragraph]': 'true'
  }
})
export class DefaultLayoutInfoDirective {
}

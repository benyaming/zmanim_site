import { Directive, HostBinding } from '@angular/core';

@Directive({
  selector: '[appDefaultLayoutInfo]',
})
export class DefaultLayoutInfoDirective {
  @HostBinding('style.min-width.rem')
  minWidth = 20;
}

import { Directive, HostBinding } from '@angular/core';

@Directive({
  selector: '[appDefaultLayoutInfo]',
})
export class DefaultLayoutInfoDirective {
  @HostBinding('style.min-width.rem')
  private readonly minWidth = 20;
}

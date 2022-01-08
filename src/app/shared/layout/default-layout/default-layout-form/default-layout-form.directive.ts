import { Directive, HostBinding } from '@angular/core';

@Directive({
  selector: '[appDefaultLayoutForm]',
})
export class DefaultLayoutFormDirective {
  @HostBinding('style.min-width.rem')
  minWidth = 20;
}

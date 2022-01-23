import { Directive, HostBinding } from '@angular/core';

@Directive({
  selector: '[appDefaultLayoutForm]',
})
export class DefaultLayoutFormDirective {
  @HostBinding('style.min-width.rem')
  private readonly minWidth = 20;
}

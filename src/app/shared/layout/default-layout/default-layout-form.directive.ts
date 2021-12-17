import {Directive, HostBinding} from '@angular/core';

@Directive({
  selector: '[appDefaultLayoutForm]'
})
export class DefaultLayoutFormDirective {
  @HostBinding('style.display') display = 'flex';
  @HostBinding('style.flex-direction') flexDirection = 'column';
}

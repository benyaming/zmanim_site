import {Directive, HostBinding} from '@angular/core';

@Directive({
  selector: '[appDefaultLayoutInfo]'
})
export class DefaultLayoutInfoDirective {
  @HostBinding('style.display') display = 'flex';
  @HostBinding('style.flex-direction') flexDirection = 'column';
}

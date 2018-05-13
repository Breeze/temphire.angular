import { Directive, ElementRef, Input, OnChanges, SimpleChanges } from '@angular/core';

// A directive that replaces \n with <br>
//
// Example:
//
// <div [newLine]="textWithNewLines"></div>
@Directive({
    selector: '[newLine]'
})
export class NewLineDirective implements OnChanges {

    @Input() newLine: string;

    constructor(private _el: ElementRef) { }

    ngOnChanges(changes: SimpleChanges) {
        const val = (this.newLine || '').replace(/\n/g, '<br>');
        this._el.nativeElement.innerHTML = val;
    }
}

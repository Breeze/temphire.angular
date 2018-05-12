import { Directive, OnInit } from '@angular/core';

@Directive({
    selector: '[scrollToTop]'
})
export class ScrollToTopDirective implements OnInit {

    ngOnInit() {
        window.scrollTo(0, 0);
    }
}

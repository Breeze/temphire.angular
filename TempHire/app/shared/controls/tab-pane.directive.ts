import { ContentChild, Directive, Input, TemplateRef, ViewContainerRef } from '@angular/core';

@Directive({
    selector: '[tab-pane]'
})
export class TabPane {
    @Input() title: string;
    @Input() hasData: boolean = true;
    @Input() canDeactivate: boolean = true;
    _active: boolean = false;

    // add a '#self' attribute to any TabPane to make it available here or within the TabContainer.
    @ContentChild('self') component: any;

    constructor(public viewContainer: ViewContainerRef,
                public templateRef: TemplateRef<any>) { }

    @Input() set active(active: boolean) {
        if (active == this._active) { return; }
        this._active = active;
        if (active) {
            this.viewContainer.createEmbeddedView(this.templateRef);
        } else {
            this.viewContainer.remove(0);
        }
    }

    get active(): boolean {
        return this._active;
    }
}

import { Component, ContentChildren, EventEmitter, Input, Output, QueryList } from '@angular/core';

import { TabPane } from './tab-pane.directive';

@Component({
    selector: 'tab-container',
    template: `
    <ul class="nav nav-tabs">
        <li *ngIf="title"><h3 style="margin-top: 10px; margin-right: 50px; margin-bottom:5px;">{{title}}</h3></li>
        <li *ngFor="let pane of panes; let i = index"
            (click)="selectTab(i)"
            role="presentation" [class.active]="pane.active" [class.has-no-data]="pane.hasData == false" >
        <a href="javascript:void(0)"><span>{{pane.title}}</span></a>
        </li>
    </ul>
    <ng-content></ng-content>
    `
})
export class TabContainer {

    // add next line to any component that hosts a TabContainer in order to make the tabContainer available internally
    // only needed if you actually need to access that tabContainer programatically.
    //    @ViewChild(TabContainer) tabContainer: TabContainer;

    @ContentChildren(TabPane) panes: QueryList<TabPane>;
    @Input() title: string;
    @Output() tabChange = new EventEmitter<number>();

    currentPane: TabPane;

    selectTab(pane: number) {

        const currentPane = this.getCurrentPane();

        if (currentPane) {
            const comp = currentPane.component;
            if (currentPane.canDeactivate === false) {
                return;
            }
            if (comp && comp.canDeactivate) {
                if (!comp.canDeactivate()) {
                    return;
                }
            }
            if (comp && comp.onDeactivate) {
                comp.onDeactivate();
            }
        }

        // wait a tick for panes array update before setting active pane
        setTimeout(() => {
            this.currentPane = this.panes.toArray()[pane];
            this.panes.toArray()
                .forEach((p: TabPane, i: number) => p.active = i === pane);
            this.tabChange.emit(pane);
        }, 0);

    }

    getCurrentPane(): TabPane {
        if (!this.currentPane && this.panes.length > 0) {
            this.currentPane = this.panes.toArray()[0];
        }
        return this.currentPane;
    }

    getCurrentComponent<T>(): T {
        const pane = this.getCurrentPane();
        return (pane && pane.component) as T;
    }
}

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NewLineDirective, ScrollToTopDirective } from './directives/common';
import { TabContainer } from './controls/tab-container.component';
import { TabPane } from './controls/tab-pane.directive';

@NgModule({
    imports: [CommonModule],
    declarations: [
        NewLineDirective,
        TabContainer,
        TabPane,
        ScrollToTopDirective
    ],
    exports: [
        NewLineDirective,
        TabContainer,
        TabPane,
        ScrollToTopDirective
    ]
})
export class SharedModule { }
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { TabContainer } from './controls/tab-container.component';
import { TabPane } from './controls/tab-pane.directive';
import { NewLineDirective, ScrollToTopDirective } from './directives/common';

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

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NewLineDirective, ScrollToTopDirective } from './directives/common';
import { TabContainer } from './controls/tab-container.component';
import { TabPane } from './controls/tab-pane.directive';
import { UnitOfWork } from './services/common';

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
    ],
    providers: [UnitOfWork]
})
export class SharedModule { }
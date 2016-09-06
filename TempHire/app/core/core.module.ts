import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from '../shared/shared.module';

import {
    MessageBoxComponent, CanDeactivateGuard, PrepareGuard,
    ErrorHandler, EntityManagerProvider, DialogService, customExceptionHandlerProvider,
    BusyService, AuthService
} from './services/common';

// ATTENTION: Never import this module into a lazy loaded module. Only import into app module.
@NgModule({
    imports: [CommonModule, SharedModule],
    declarations: [MessageBoxComponent],
    exports: [MessageBoxComponent],
    providers: [
        CanDeactivateGuard,
        PrepareGuard,
        ErrorHandler,
        EntityManagerProvider,
        DialogService,
        customExceptionHandlerProvider,
        BusyService,
        AuthService
    ]
})
export class CoreModule { }
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { SharedModule } from '../shared/shared.module';

import {
    AuthService, BusyService, CanDeactivateGuard,
    customExceptionHandlerProvider, DialogService, EntityManagerProvider, ErrorHandler,
    MessageBoxComponent, PrepareGuard, UnitOfWork
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
        AuthService,
        UnitOfWork
    ]
})
export class CoreModule { }

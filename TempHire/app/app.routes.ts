import { RouterModule, Routes } from '@angular/router';

import { CanDeactivateGuard, PrepareGuard } from './core/services/common';

import { HomeComponent } from './home.component';
import { LoginComponent } from './login.component';

export const routes: Routes = [
    {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full'
    },
    {
        path: 'login',
        component: LoginComponent
    },
    {
        path: 'home',
        component: HomeComponent,
        canActivate: [PrepareGuard]
    }
];

export const routing = RouterModule.forRoot(routes, { enableTracing: true, useHash: true });

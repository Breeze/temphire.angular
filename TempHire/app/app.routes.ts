import { RouterModule, Routes } from '@angular/router';

import { installGuards } from './core/services/common';

import { LoginComponent } from './login.component';
import { HomeComponent } from './home.component';

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
        component: HomeComponent
    }
];

export const routing = RouterModule.forRoot(installGuards(routes), { enableTracing: true, useHash: true });
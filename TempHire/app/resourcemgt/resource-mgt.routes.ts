import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve, RouterModule, Routes } from '@angular/router';

import { CanDeactivateGuard, PrepareGuard } from '../core/services/common';

import { ResourceDetailComponent } from './resource-detail.component';
import { ResourceMgtComponent } from './resource-mgt.component';

export const resourceMgtRoutes: Routes = [
    {
        path: 'resourcemgt',
        component: ResourceMgtComponent,
        canActivate: [PrepareGuard]
    },
    {
        path: 'resourcemgt',
        component: ResourceMgtComponent,
        canActivate: [PrepareGuard],
        children: [
            {
                path: ':id',
                component: ResourceDetailComponent,
                canDeactivate: [CanDeactivateGuard]
            }
        ]
    }
];

export const routing = RouterModule.forChild(resourceMgtRoutes);

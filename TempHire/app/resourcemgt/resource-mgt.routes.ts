import { Injectable } from '@angular/core'
import { Routes, RouterModule, Resolve, ActivatedRouteSnapshot } from '@angular/router';

import { ResourceMgtComponent } from './resource-mgt.component';
import { ResourceDetailComponent } from './resource-detail.component';
import { PrepareGuard, CanDeactivateGuard } from '../core/services/common';

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
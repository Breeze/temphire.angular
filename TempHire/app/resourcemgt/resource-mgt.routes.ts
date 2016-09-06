import { Injectable } from '@angular/core'
import { Routes, RouterModule, Resolve, ActivatedRouteSnapshot } from '@angular/router';

import { ResourceMgtComponent } from './resource-mgt.component';
import { ResourceDetailComponent } from './resource-detail.component';
import { installGuards } from '../core/services/common';

export const resourceMgtRoutes: Routes = [
    {
        path: 'resourcemgt',
        component: ResourceMgtComponent
    },
    {
        path: 'resourcemgt',
        component: ResourceMgtComponent,
        children: [
            {
                path: ':id',
                component: ResourceDetailComponent
            }
        ]
    }
];

export const routing = RouterModule.forChild(installGuards(resourceMgtRoutes));
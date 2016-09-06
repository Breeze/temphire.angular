import { Injectable }    from '@angular/core';
import { CanActivate, CanDeactivate, ActivatedRouteSnapshot, RouterStateSnapshot, Routes, Resolve, Router } from '@angular/router';
import { Observable } from 'rxjs/Observable';

import { EntityManagerProvider } from './entity-manager-provider';
import { BusyService } from './busy.service';
import { AuthService } from './auth.service';

export interface CanComponentDeactivate {
    canDeactivate: () => boolean | Observable<boolean> | Promise<boolean>;
}

@Injectable()
export class CanDeactivateGuard implements CanDeactivate<CanComponentDeactivate> {
    canDeactivate(component: CanComponentDeactivate): Observable<boolean> | Promise<boolean> | boolean {
        return component.canDeactivate ? component.canDeactivate() : true;
    }
}

@Injectable()
export class PrepareGuard implements CanActivate {
    constructor(private entityManagerProvider: EntityManagerProvider, private authService: AuthService, private router: Router) { }

    canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
        return this.entityManagerProvider.prepare()
            .then(() => true)
            .catch(e => {
                if (e.status == 401) {
                    this.authService.redirectUrl = state.url;
                    this.router.navigate(['/login']);
                    return false;
                }

                // Something else happened
                throw e;
            });
    }
}

export function installGuards(routes: Routes): Routes {
    if (!routes) return routes;

    routes.forEach(route => {
        // No guards on login route
        if (route.path == 'login') return;

        route.canDeactivate = [CanDeactivateGuard];
        route.canActivate = [PrepareGuard];

        installGuards(route.children);
    });
    return routes;
}

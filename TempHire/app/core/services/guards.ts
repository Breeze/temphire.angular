import { Injectable }    from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, CanDeactivate, Resolve, Router, RouterStateSnapshot, Routes } from '@angular/router';
import { Observable } from 'rxjs';

import { AuthService } from './auth.service';
import { BusyService } from './busy.service';
import { EntityManagerProvider } from './entity-manager-provider';

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

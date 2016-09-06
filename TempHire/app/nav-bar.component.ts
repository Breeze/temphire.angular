import { Component } from '@angular/core';

import { BusyService, AuthService } from './core/services/common';

@Component({
    selector: 'nav-bar',
    moduleId: module.id,
    templateUrl: './nav-bar.html'
})
export class NavBarComponent {

    routes = [
        { title: 'Home', routerLink: ['/home'] },
        { title: 'Resource Management', routerLink: ['/resourcemgt'] }
    ];

    constructor(public busyService: BusyService, private authService: AuthService) { }

    logout() {
        this.authService.logout().then(() => {
            document.location.reload();
        });
    }
}
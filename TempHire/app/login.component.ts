import { Component } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService, DialogService } from './core/services/common';

@Component({
    moduleId: module.id,
    templateUrl: './login.html'
})
export class LoginComponent {

    username: string = 'Admin';
    password: string = 'password';

    constructor(private authService: AuthService, private router: Router, private dialogService: DialogService) { }

    loginUser() {
        if (!this.isValid) return;

        this.authService.loginUser(this.username, this.password)
            .then(() => {
                this.router.navigateByUrl(this.authService.redirectUrl || '/');
            }).catch(e => {
                if (e.status == 401) {
                    return this.dialogService.messageBox('Unauthorized', 'Please verify your username and password and try again.', ['Ok']);
                }

                // Something else happened
                throw e;
            });
    }

    private isValid(): boolean {
        return !!this.username && !!this.password;
    }
}
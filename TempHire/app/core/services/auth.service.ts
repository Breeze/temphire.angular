import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import 'rxjs/add/operator/toPromise';

@Injectable()
export class AuthService {
    redirectUrl: string;

    constructor(private http: Http) { }

    loginUser(username: string, password: string): Promise<any> {
        let data = {
            username: username,
            password: password
        };

        return this.http.post('/breeze/account/login', data).toPromise();
    }

    logout(): Promise<any> {
        return this.http.post('/breeze/account/logout', {}).toPromise();
    }
}
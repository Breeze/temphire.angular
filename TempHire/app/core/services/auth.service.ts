import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';


@Injectable()
export class AuthService {
    redirectUrl: string;

    constructor(private http: HttpClient) { }

    loginUser(username: string, password: string): Promise<any> {
        let data = {
            username: username,
            password: password
        };

        return this.http.post('/breeze/account/login', data, { responseType: 'text' }).toPromise();
    }

    logout(): Promise<any> {
        return this.http.post('/breeze/account/logout', {}, { responseType: 'text' }).toPromise();
    }
}
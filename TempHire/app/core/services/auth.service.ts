import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable()
export class AuthService {
    redirectUrl: string;

    constructor(private http: HttpClient) { }

    loginUser(username: string, password: string): Promise<any> {
        const data = {
            username,
            password
        };

        return this.http.post('/breeze/account/login', data, { responseType: 'text' }).toPromise();
    }

    logout(): Promise<any> {
        return this.http.post('/breeze/account/logout', {}, { responseType: 'text' }).toPromise();
    }
}

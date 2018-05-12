import { Injectable } from '@angular/core';

@Injectable()
export class BusyService {

    private _busyCounter: number = 0;

    get isBusy(): boolean {
        return this._busyCounter > 0;
    }

    async busy<T>(op: Promise<T>): Promise<T> {
        this._busyCounter++;

        try {
            return await op;
        } finally {
            this._busyCounter--;
        }
    }
}

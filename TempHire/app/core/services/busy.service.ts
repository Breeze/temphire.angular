import { Injectable } from '@angular/core';

@Injectable()
export class BusyService {

    private _busyCounter: number = 0;

    get isBusy(): boolean {
        return this._busyCounter > 0;
    }

    busy<T>(op: Promise<T>): Promise<T> {
        setTimeout(() => {
            this._busyCounter++;
            op.then(result => {
                this._busyCounter--;
            }).catch((reason: any) => {
                this._busyCounter--;
            });
        }, 300);

        return op;
    }
}
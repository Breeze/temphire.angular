import { Component, Injectable } from '@angular/core';
import { core } from 'breeze-client';

@Injectable()
export class DialogService {
    title: string;
    message: string;
    buttonNames: string[];

    private _result: string;

    constructor() { }

    messageBox(title: string, message: string, buttonNames?: string[]): Promise<string> {
        delete this._result;
        this.title = title;
        this.message = message;
        this.buttonNames = buttonNames || ['Ok', 'Cancel'];

        let el = this.getModalElement();
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                el.modal({ backdrop: 'static', keyboard: false }).on('hidden.bs.modal', () => {
                    resolve(this._result);
                });
            });
        });
    }

    select(button: string) {
        this._result = button;
        this.getModalElement().modal('hide');
    }

    private getModalElement() {
        return $('#message-box-modal');
    }
}

@Component({
    selector: 'message-box',
    moduleId: module.id,
    templateUrl: './message-box.html'
})
export class MessageBoxComponent {

    constructor(public service: DialogService) { }
}

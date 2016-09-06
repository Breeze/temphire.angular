import { ElementRef } from '@angular/core';

export abstract class ModalDialog<T> {

    modalParent: any;  // a this
    modalResult: T;
    validationFn: (x: T) => string;
    validationMessage: string;

    constructor(public elementRef: ElementRef) { }

    protected showModal(parent: any, validateFn?: (x: any) => string): Promise<T> {
        let ele = this.elementRef.nativeElement.firstElementChild;
        let modalEle = jQuery(ele);
        this.modalParent = parent;
        this.validationMessage = null;
        if (validateFn) {
            this.validationFn = validateFn.bind(parent);
        }
        let p = new Promise((resolve, reject) => {
            modalEle.modal({ backdrop: 'static', keyboard: false }).on('hidden.bs.modal', () => {
                resolve(this.modalResult);
            });
        });
        return p;
    }

    protected returnModal(result: T) {
        if (result != null && this.validationFn) {
            this.validationMessage = this.validationFn(result);
            if (this.validationMessage != null) return;
        }
        this.modalResult = result;
        this.hideModal();
    }

    protected hideModal() {
        let ele = this.elementRef.nativeElement.firstElementChild;
        let modalEle = jQuery(ele);
        modalEle.modal("hide");
    }
}


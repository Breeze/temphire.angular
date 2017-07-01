﻿import { Component, Input, ElementRef } from '@angular/core';

import { ModalDialog } from '../shared/controls/modal-dialog';

import { StaffingResource } from '../core/entities/entity-model';

export interface Name {
    firstName?: string;
    middleName?: string;
    lastName?: string;
}

@Component({
    selector: 'resource-name-editor',
    templateUrl: './resource-name-editor.html'
})
export class ResourceNameEditorComponent extends ModalDialog<Name> {

    @Input() model: StaffingResource;

    title: string;
    name: Name = {};

    constructor(elementRef: ElementRef) {
        super(elementRef);
    }

    show(parent: any, title: string) {
        this.title = title;
        this.name = {};
        if (this.model) {
            this.name = {
                firstName: this.model.firstName,
                middleName: this.model.middleName,
                lastName: this.model.lastName
            };
        }

        return this.showModal(parent);
    }

    get canOk(): boolean {
        return !!this.name.firstName && !!this.name.lastName;
    }

    ok() {
        this.returnModal(this.name);
    }

    cancel() {
        this.returnModal(null);
    }
}
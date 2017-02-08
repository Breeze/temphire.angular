import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs/Observable';

import { BusyService, DialogService, CanComponentDeactivate } from '../core/services/common';

import { StaffingResource } from '../core/entities/entity-model';
import { ResourceMgtUnitOfWork } from './resource-mgt-unit-of-work';
import { ResourceNameEditorComponent } from './resource-name-editor.component';

@Component({
    moduleId: module.id,
    templateUrl: './resource-detail.html',
    providers: [
        ResourceMgtUnitOfWork   // Inject a new instance for this component
    ]
})
export class ResourceDetailComponent implements OnInit, CanComponentDeactivate {

    @ViewChild(ResourceNameEditorComponent) nameEditor: ResourceNameEditorComponent;

    model: StaffingResource;

    constructor(private unitOfWork: ResourceMgtUnitOfWork, private busyService: BusyService, private route: ActivatedRoute, private dialogService: DialogService, private router: Router) { }

    ngOnInit() {
        this.route.params.forEach(params => {
            this.unitOfWork.clear();

            let reportId = params['id'];
            if (reportId !== 'new') {
                // Load existing StaffingResource
                this.busyService.busy(this.unitOfWork.staffingResources.withId(reportId).then(data => {
                    if (data) {
                        this.model = data;
                    } else {
                        this.dialogService.messageBox('Not found!', 'The staffing resource with the given identifier wasn\'t found.', ['Ok']);
                    }
                }));
            } else {
                // Create new StaffingResource
                let config = {
                    firstName: params['firstName'],
                    middleName: params['middleName'],
                    lastName: params['lastName']
                }

                this.busyService.busy(this.unitOfWork.staffingResourceFactory.create(config).then(data => {
                    this.model = data;
                }));
            }
        });
    }

    canDeactivate(): boolean | Observable<boolean> | Promise<boolean> {
        if (!this.unitOfWork.hasChanges()) return true;

        let title = 'Confirm';
        let message = 'You have unsaved changes. Would you like to save?';
        let buttons = ['Yes', 'No', 'Cancel'];
        return this.dialogService.messageBox(title, message, buttons).then(result => {
            if (result === 'Yes') return this.save(true, true).then(() => true);
            if (result === 'No') {
                this.cancel(true);
                return true;
            }

            return false;
        });
    }

    get canSave(): boolean {
        return this.unitOfWork.hasChanges();
    }

    save(suppressConfirmation: boolean, deactivating: boolean = false) {
        return this.busyService.busy(this.unitOfWork.commit()).then(() => {
            if (suppressConfirmation) return;

            return this.dialogService.messageBox('Success', 'Successfully saved data!', ['Ok']);
        }).then(() => {
            if (!deactivating) {
                // Navigate to saved model
                return this.router.navigate(['/resourcemgt', this.model.id]);
            }

            return true;
        });
    }

    cancel(deactivating: boolean = false) {
        this.unitOfWork.rollback();

        // If model is detached after rollback, navigate back to parent.
        if (this.model.entityAspect.entityState.isDetached() && !deactivating) {
            this.router.navigate(['/resourcemgt']);
        }
    }

    get canDelete(): boolean {
        return !this.model.entityAspect.entityState.isAdded();
    }

    delete() {
        this.model.delete();

        return this.busyService.busy(this.unitOfWork.commit()).then(() => {
            this.router.navigate(['/resourcemgt']);
        }).catch(e => {
            this.unitOfWork.rollback();
            throw e;
        });
    }

    editName() {
        this.nameEditor.show(this, 'Edit resource name').then(name => {
            if (name) {
                this.model.firstName = name.firstName;
                this.model.middleName = name.middleName;
                this.model.lastName = name.lastName;
            }
        });
    }
}
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

import { ResourceMgtUnitOfWork, StaffingResourceListItem } from './resource-mgt-unit-of-work';
import { BusyService } from '../core/services/common';

@Component({
    moduleId: module.id,
    templateUrl: './resource-mgt.html'
})
export class ResourceMgtComponent implements OnInit, OnDestroy {

    staffingResources: StaffingResourceListItem[];
    staffingResourceId: string;

    private unsubscribeFromEvents: () => void;

    constructor(private unitOfWork: ResourceMgtUnitOfWork, private busyService: BusyService, private router: Router, private route: ActivatedRoute) { }

    ngOnInit() {
        if (this.route.firstChild) {
            this.route.firstChild.params.forEach(params => {
                this.staffingResourceId = params['id'];
            });
        }

        let subscription = ResourceMgtUnitOfWork.savedOrRejected.subscribe(() => {
            this.loadList();
        });
        this.unsubscribeFromEvents = () => {
            ResourceMgtUnitOfWork.savedOrRejected.unsubscribe(subscription);
        };

        this.loadList();
    }

    ngOnDestroy() {
        this.unsubscribeFromEvents();
    }

    onSelect(staffingResource: StaffingResourceListItem) {
        this.router.navigate(['/resourcemgt', staffingResource.id]);
    }

    private loadList() {
        return this.busyService.busy(this.unitOfWork.staffingResourceListItems.all()
            .then(data => {
                this.staffingResources = data;
                if (!this.staffingResourceId && data.length > 0) {
                    this.router.navigate(['/resourcemgt', data[0].id]);
                }
                return data;
            }));
    }
}
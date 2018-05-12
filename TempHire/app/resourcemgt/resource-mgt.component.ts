import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';

import { ResourceMgtUnitOfWork, StaffingResourceListItem } from './resource-mgt-unit-of-work';
import { BusyService } from '../core/services/common';

import { ResourceNameEditorComponent } from './resource-name-editor.component';

@Component({
    templateUrl: './resource-mgt.html'
})
export class ResourceMgtComponent implements OnInit, OnDestroy {

    @ViewChild(ResourceNameEditorComponent) nameEditor: ResourceNameEditorComponent;

    staffingResources: StaffingResourceListItem[];
    staffingResourceId: string;

    private committedSub: Subscription;

    constructor(private unitOfWork: ResourceMgtUnitOfWork, private busyService: BusyService, private router: Router, private route: ActivatedRoute) { }

    ngOnInit() {
        if (this.route.firstChild) {
            this.route.firstChild.params.forEach(params => {
                this.staffingResourceId = params['id'];
                this.scrollIntoView();
            });
        }

        this.committedSub = ResourceMgtUnitOfWork.committed.subscribe(() => {
            this.loadList();
        });
        this.loadList();
    }

    ngOnDestroy() {
        this.committedSub.unsubscribe();
    }

    onSelect(staffingResource: StaffingResourceListItem) {
        this.router.navigate(['/resourcemgt', staffingResource.id]);
    }

    beginNew() {
        this.nameEditor.show(this, 'New resource name').then(name => {
            if (name) {
                this.router.navigate(['/resourcemgt/new', name]);
            }
        });
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

    private scrollIntoView() {
        // Scroll selected item into view
        setTimeout(() => {
            let container = $('#search-result');
            let scrollTo = $('#search-result .info');
            if (scrollTo.length) {
                let scrollTop = scrollTo.offset().top - container.offset().top + container.scrollTop();
                if (scrollTop > container.scrollTop() + container.height()) {
                    container.animate({
                        scrollTop: scrollTop
                    });
                }
            }
        });
    }
}
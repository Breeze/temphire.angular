import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { SharedModule } from '../shared/shared.module';

import { ResourceMgtComponent } from './resource-mgt.component';
import { ResourceDetailComponent } from './resource-detail.component';
import { ResourceContactsComponent } from './resource-contacts.component';
import { ResourceNameEditorComponent } from './resource-name-editor.component'

import { ResourceMgtUnitOfWork } from './resource-mgt-unit-of-work';

import { routing } from './resource-mgt.routes';

@NgModule({
    imports: [
        CommonModule,
        SharedModule,
        FormsModule,
        routing
    ],
    declarations: [
        ResourceMgtComponent,
        ResourceDetailComponent,
        ResourceContactsComponent,
        ResourceNameEditorComponent
    ],
    providers: [
        ResourceMgtUnitOfWork  // The UoW used for the module
    ]
})
export class ResourceMgtModule { }
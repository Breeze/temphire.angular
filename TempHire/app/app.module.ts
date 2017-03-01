import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpModule } from '@angular/http';
import { FormsModule } from '@angular/forms';
import { BreezeBridgeAngularModule } from 'breeze-bridge-angular'

import { routing } from './app.routes';

import { CoreModule } from './core/core.module';
import { SharedModule } from './shared/shared.module';
import { ResourceMgtModule } from './resourcemgt/resource-mgt.module';

import { AppComponent } from './app.component';
import { LoginComponent } from './login.component';
import { HomeComponent } from './home.component';
import { NavBarComponent } from './nav-bar.component';

@NgModule({
    imports: [
        BreezeBridgeAngularModule,
        BrowserModule,
        HttpModule,
        FormsModule,
        routing,
        CoreModule,
        SharedModule,
        ResourceMgtModule
    ],
    declarations: [
        AppComponent, LoginComponent, HomeComponent, NavBarComponent
    ],
    bootstrap: [AppComponent]
})
export class AppModule { }
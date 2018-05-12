import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { BreezeBridgeHttpClientModule } from 'breeze-bridge2-angular';

import { routing } from './app.routes';

import { CoreModule } from './core/core.module';
import { ResourceMgtModule } from './resourcemgt/resource-mgt.module';
import { SharedModule } from './shared/shared.module';

import { AppComponent } from './app.component';
import { HomeComponent } from './home.component';
import { LoginComponent } from './login.component';
import { NavBarComponent } from './nav-bar.component';

@NgModule({
    imports: [
        BreezeBridgeHttpClientModule,
        BrowserModule,
        HttpClientModule,
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

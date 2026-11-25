import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from '@openng/optimus-ui/button';

import { FrameworkMarkComponent } from '../core/framework-mark.component';

/**
 * Port of `ViewModels/HomeViewModel.cs` + `Views/HomeView.xaml`.
 *
 * The original was a static welcome page describing what the sample demonstrates.  The text is
 * updated to describe the converted stack rather than the WPF one, but it plays the same role: it
 * is the default workspace the shell navigates to at start-up and after logout.  It is laid out as
 * a hero with a way into Resource Management, and three tiles: what the app shows, what it was
 * converted from, and Quinn.
 */
@Component({
  selector: 'app-home',
  imports: [RouterLink, ButtonDirective, FrameworkMarkComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {}

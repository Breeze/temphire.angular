import { Component } from '@angular/core';

/**
 * Port of `ViewModels/HomeViewModel.cs` + `Views/HomeView.xaml`.
 *
 * The original was a static welcome page describing what the sample demonstrates.  The text is
 * updated to describe the converted stack rather than the WPF one, but it plays the same role: it
 * is the default workspace the shell navigates to at start-up and after logout.
 */
@Component({
  selector: 'app-home',
  template: `
    <div class="home">
      <h1 class="home__title">WELCOME</h1>

      <p>
        Our simple resource management application demonstrates a data-rich, multi-screen business
        application - the type of application that Breeze makes easier to build.
      </p>

      <p>
        It manages view composition, navigation properties, data binding, validation, multiple
        entity managers, multiple data stores, security, and more.
      </p>

      <p>
        This is a conversion of the original WPF/DevForce TempHire sample: the client is Angular
        with BreezeJS in place of DevForce's client-side EntityManager, and the server is ASP.NET
        Core with Breeze and EF Core in place of the DevForce EntityServer.
      </p>

      <p>
        Pick <strong>Resource Management</strong> from the toolbar to browse and edit staffing
        resources.
      </p>
    </div>
  `,
  styles: [
    `
      .home {
        max-width: 52rem;
        margin: 0 auto;
        padding: 3rem 2rem;
        font-family: Verdana, sans-serif;
        font-size: 1rem;
        line-height: 1.6;
      }

      .home__title {
        font-family: Verdana, sans-serif;
        font-size: 1.75rem;
        font-weight: 400;
        margin: 0 0 1.5rem;
      }
    `,
  ],
})
export class HomeComponent {}

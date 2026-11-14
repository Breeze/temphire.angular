import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from '@openng/optimus-ui/button';

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
  imports: [RouterLink, ButtonDirective],
  template: `
    <div class="home">
      <section class="hero">
        <div class="hero__text">
          <p class="hero__eyebrow">Welcome to TempHire</p>
          <h1 class="hero__title">Staffing data, made easy to work with</h1>
          <p class="hero__lead">
            Our simple resource management application demonstrates a data-rich, multi-screen
            business application - the type of application that Breeze makes easier to build.
          </p>
          <a pButton routerLink="/resourcemgt" class="hero__cta">
            Open Resource Management
            <i class="pi pi-arrow-right"></i>
          </a>
        </div>
        <div class="hero__art" aria-hidden="true">
          <span class="hero__orb hero__orb--large temphire-orb">T</span>
          <span class="hero__orb hero__orb--small temphire-orb"></span>
        </div>
      </section>

      <section class="tiles">
        <article class="tile temphire-elevated">
          <span class="tile__icon"><i class="pi pi-database"></i></span>
          <h2 class="tile__title">Rich data management</h2>
          <p>
            It manages view composition, navigation properties, data binding, validation, multiple
            entity managers, multiple data stores, security, and more.
          </p>
        </article>

        <article class="tile temphire-elevated">
          <span class="tile__icon"><i class="pi pi-sync"></i></span>
          <h2 class="tile__title">From WPF to the web</h2>
          <p>
            A conversion of the original WPF/DevForce TempHire sample: Angular with BreezeJS on the
            client, ASP.NET Core with Breeze and EF Core on the server.
          </p>
        </article>

        <article class="tile temphire-elevated">
          <span class="tile__icon"><i class="pi pi-sparkles"></i></span>
          <h2 class="tile__title">Ask Quinn</h2>
          <p>
            Quinn, the assistant, answers questions about your company's staffing data. Click the
            round button in the bottom right corner to start.
          </p>
        </article>
      </section>
    </div>
  `,
  styles: [
    `
      .home {
        max-width: 72rem;
        margin: 0 auto;
        padding: 2rem 1.75rem 3rem;
        display: flex;
        flex-direction: column;
        gap: 1.75rem;
      }

      /* The hero: deep blue, lit from the top left, with two glossy orbs on the right. */
      .hero {
        position: relative;
        display: flex;
        align-items: center;
        gap: 2rem;
        padding: 2.75rem 3rem;
        overflow: hidden;
        color: #ffffff;
        border-radius: 22px;
        background:
          radial-gradient(700px 300px at 0% 0%, rgba(115, 169, 216, 0.55), transparent 70%),
          radial-gradient(500px 300px at 100% 100%, rgba(15, 47, 77, 0.6), transparent 70%),
          linear-gradient(
            135deg,
            #2c72b3 0%,
            var(--temphire-accent) 50%,
            var(--temphire-accent-deep) 100%
          );
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.25),
          0 2px 4px rgba(15, 47, 77, 0.15),
          0 24px 48px rgba(15, 47, 77, 0.25);
      }

      .hero__text {
        flex: 1 1 32rem;
        position: relative;
        z-index: 1;
      }

      .hero__eyebrow {
        margin: 0 0 0.5rem;
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.75);
      }

      .hero__title {
        margin: 0 0 1rem;
        font-size: 2.4rem;
        font-weight: 800;
        line-height: 1.12;
        letter-spacing: -0.02em;
        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      }

      .hero__lead {
        max-width: 38rem;
        margin: 0 0 1.75rem;
        font-size: 1.05rem;
        line-height: 1.6;
        color: rgba(255, 255, 255, 0.88);
      }

      /* A white, raised button on the blue. */
      .hero__cta.p-button {
        gap: 0.6rem;
        padding: 0.75rem 1.3rem;
        border: none;
        border-radius: 999px;
        font-weight: 700;
        text-decoration: none;
        color: var(--temphire-accent);
        background: linear-gradient(180deg, #ffffff, #e3eef9);
        box-shadow:
          inset 0 1px 0 #ffffff,
          0 2px 4px rgba(0, 0, 0, 0.15),
          0 10px 24px rgba(0, 0, 0, 0.2);
        transition:
          transform 0.15s ease,
          box-shadow 0.15s ease;
      }

      .hero__cta.p-button:hover {
        color: var(--temphire-accent-deep);
        background: linear-gradient(180deg, #ffffff, #d7e7f5);
        transform: translateY(-1px);
        box-shadow:
          inset 0 1px 0 #ffffff,
          0 4px 8px rgba(0, 0, 0, 0.18),
          0 14px 30px rgba(0, 0, 0, 0.24);
      }

      .hero__art {
        position: relative;
        flex: 0 0 15rem;
        height: 13rem;
      }

      .hero__orb {
        position: absolute;
        font-family: Verdana, sans-serif;
      }

      .hero__orb--large {
        right: 1.5rem;
        top: 0.5rem;
        width: 10rem;
        height: 10rem;
        font-size: 4.5rem;
      }

      .hero__orb--small {
        left: 0.5rem;
        bottom: 0;
        width: 4rem;
        height: 4rem;
        opacity: 0.9;
      }

      .tiles {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
        gap: 1.25rem;
      }

      .tile {
        padding: 1.5rem 1.5rem 1.25rem;
        border-radius: var(--temphire-radius-lg);
        line-height: 1.55;
        color: #3c4a5a;
      }

      .tile p {
        margin: 0;
      }

      .tile__icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2.75rem;
        height: 2.75rem;
        margin-bottom: 0.9rem;
        border-radius: 12px;
        font-size: 1.2rem;
        color: #ffffff;
        background: linear-gradient(135deg, #4f8fca, var(--temphire-accent));
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.35),
          0 6px 14px rgba(29, 83, 128, 0.3);
      }

      .tile__title {
        margin: 0 0 0.4rem;
        font-size: 1.1rem;
        color: var(--temphire-accent);
      }

      @media (max-width: 760px) {
        .hero {
          padding: 2rem 1.5rem;
        }

        .hero__art {
          display: none;
        }

        .hero__title {
          font-size: 1.9rem;
        }
      }
    `,
  ],
})
export class HomeComponent {}

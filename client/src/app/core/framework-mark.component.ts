import { Component } from '@angular/core';

/**
 * The Angular logo on a white disc, worn at the bottom right of a TempHire orb (`.temphire-orb`),
 * so the logo says which version of TempHire is running: the React version's orb wears React's.
 *
 * Purely decorative, like the orb itself.  The logo is Angular's own (angular/angular,
 * `adev/shared-docs/pipeline/tutorials/common/src/assets/angular.svg`).
 */
@Component({
  selector: 'app-framework-mark',
  template: `
    <svg viewBox="0 0 223 236" aria-hidden="true" focusable="false">
      <path
        fill="url(#temphire-angular-b)"
        d="m222.077 39.192-8.019 125.923L137.387 0l84.69 39.192Zm-53.105 162.825-57.933 33.056-57.934-33.056 11.783-28.556h92.301l11.783 28.556ZM111.039 62.675l30.357 73.803H80.681l30.358-73.803ZM7.937 165.115 0 39.192 84.69 0 7.937 165.115Z"
      />
      <path
        fill="url(#temphire-angular-c)"
        d="m222.077 39.192-8.019 125.923L137.387 0l84.69 39.192Zm-53.105 162.825-57.933 33.056-57.934-33.056 11.783-28.556h92.301l11.783 28.556ZM111.039 62.675l30.357 73.803H80.681l30.358-73.803ZM7.937 165.115 0 39.192 84.69 0 7.937 165.115Z"
      />
      <defs>
        <linearGradient id="temphire-angular-b" x1="49.009" x2="225.829" y1="213.75" y2="129.722" gradientUnits="userSpaceOnUse">
          <stop stop-color="#E40035" />
          <stop offset=".24" stop-color="#F60A48" />
          <stop offset=".352" stop-color="#F20755" />
          <stop offset=".494" stop-color="#DC087D" />
          <stop offset=".745" stop-color="#9717E7" />
          <stop offset="1" stop-color="#6C00F5" />
        </linearGradient>
        <linearGradient id="temphire-angular-c" x1="41.025" x2="156.741" y1="28.344" y2="160.344" gradientUnits="userSpaceOnUse">
          <stop stop-color="#FF31D9" />
          <stop offset="1" stop-color="#FF5BE1" stop-opacity="0" />
        </linearGradient>
      </defs>
    </svg>
  `,
  styles: [
    `
      :host {
        position: absolute;
        right: -12%;
        bottom: -12%;
        width: 52%;
        height: 52%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        padding: 9%;
        border-radius: 50%;
        background: #ffffff;
        box-shadow:
          0 1px 2px rgba(15, 47, 77, 0.35),
          0 2px 6px rgba(15, 47, 77, 0.2);
      }

      svg {
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class FrameworkMarkComponent {}

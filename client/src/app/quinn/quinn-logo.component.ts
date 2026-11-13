import { Component } from '@angular/core';

/**
 * Quinn's logo: a "Q" ringed by five dots in five colours.
 *
 * The five dots are the five ingredients of a punch - the drink that gave IdeaBlade's Punch
 * framework its name, from the Hindi "panch", five - and "Quinn" comes from the Latin "quinque",
 * five.  Purely decorative: the buttons that show it carry their own labels.
 */
@Component({
  selector: 'app-quinn-logo',
  template: `
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <!-- The five ingredients, evenly around the Q, leaving room for its tail at the bottom right. -->
      <circle cx="18.5" cy="13.4" r="4" fill="#ffd166" />
      <circle cx="45.5" cy="13.4" r="4" fill="#ef476f" />
      <circle cx="54" cy="38.5" r="4" fill="#06d6a0" />
      <circle cx="32" cy="55" r="4" fill="#4cc9f0" />
      <circle cx="10" cy="38.5" r="4" fill="#f78c6b" />
      <!-- The Q. -->
      <circle cx="32" cy="32" r="13" fill="none" stroke="currentColor" stroke-width="6" />
      <path d="M38.5 38.5 L47 47" stroke="currentColor" stroke-width="6" stroke-linecap="round" />
    </svg>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        color: #ffffff;
      }

      svg {
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class QuinnLogoComponent {}

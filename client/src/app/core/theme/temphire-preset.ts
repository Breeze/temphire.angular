import { definePreset } from '@openng/optimus-ui-themes';
import Aura from '@openng/optimus-ui-themes/aura';

/**
 * TempHire's theme: Optimus UI's Aura preset with TempHire's blue as the primary colour, in place of
 * Aura's emerald.  The scale is built around `#1d5380`, the blue the original WPF app used for its
 * headings, which Quinn's launcher and chat bubbles use too, so buttons, focus rings, selected rows
 * and tabs all match the rest of the app.  Slightly rounder corners suit the card layout in
 * `styles.css`.
 */
export const TempHirePreset = definePreset(Aura, {
  primitive: {
    borderRadius: {
      none: '0',
      xs: '3px',
      sm: '5px',
      md: '8px',
      lg: '10px',
      xl: '14px',
    },
  },
  semantic: {
    primary: {
      50: '#eef5fb',
      100: '#d7e7f5',
      200: '#b0cfeb',
      300: '#80b0dc',
      400: '#4f8fca',
      500: '#2c72b3',
      600: '#225f99',
      700: '#1d5380',
      800: '#184265',
      900: '#13324c',
      950: '#0c2133',
    },
  },
});

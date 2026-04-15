import type { HTMLAttributes } from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'ot-dropdown': HTMLAttributes<HTMLElement>;
    }
  }
}

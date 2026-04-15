// Thin wrapper around oat.ink's built-in imperative toast API.
// oat ships no TypeScript declarations, so we import with a suppress comment.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { toast as oatToast } from '@knadh/oat/js/toast';

type OatVariant = 'success' | 'danger' | 'warning';

function fire(message: string, title: string, variant: OatVariant) {
  oatToast(message, title, { variant, placement: 'bottom-right' });
}

export function useToast() {
  return {
    success: (message: string, title = 'Done')    => fire(message, title, 'success'),
    error:   (message: string, title = 'Error')   => fire(message, title, 'danger'),
    warning: (message: string, title = 'Warning') => fire(message, title, 'warning'),
  };
}

import { useEffect } from 'react';

const APP_NAME = 'Salary Management';

/**
 * Sets the browser tab title, so history, bookmarks and screen readers can tell the pages apart.
 * A single-page app changes screens without loading a new page, so nothing else would change it.
 * Pass undefined while the title is not known yet (for example before an employee has loaded).
 */
export function useDocumentTitle(title: string | undefined): void {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
  }, [title]);
}

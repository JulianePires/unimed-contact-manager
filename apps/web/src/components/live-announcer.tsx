import { useSyncExternalStore } from 'react';

import { currentAnnouncement, type Politeness, subscribeAnnouncements } from '@/lib/a11y/announce';

function LiveRegion({ politeness }: { politeness: Politeness }) {
  const announcement = useSyncExternalStore(
    subscribeAnnouncements,
    () => currentAnnouncement(politeness),
    () => null,
  );
  return (
    <div
      role={politeness === 'assertive' ? 'alert' : 'status'}
      aria-live={politeness}
      aria-atomic="true"
      className="sr-only"
    >
      {/* key por anúncio: a mesma frase repetida troca o nó e volta a ser lida */}
      {announcement && <span key={announcement.id}>{announcement.message}</span>}
    </div>
  );
}

/** Regiões `aria-live` montadas uma vez no layout raiz; alimentadas por `announce()`. */
export function LiveAnnouncer() {
  return (
    <>
      <LiveRegion politeness="polite" />
      <LiveRegion politeness="assertive" />
    </>
  );
}

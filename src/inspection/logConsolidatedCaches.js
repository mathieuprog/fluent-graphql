import consolidatedCaches from './consolidatedCaches';

export default function logConsolidatedCaches() {
  console.dir(consolidatedCaches(), { depth: null });
}

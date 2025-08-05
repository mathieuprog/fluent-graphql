import { deepFreezePlain } from 'object-array-utils';
import GlobalSettings from '../document/GlobalSettings';

export function maybeDeepFreeze(data) {
  if (GlobalSettings.enableDeepFreeze) {
    return deepFreezePlain(data);
  }
  return data;
}

export function deepFreeze(data) {
  return deepFreezePlain(data);
}

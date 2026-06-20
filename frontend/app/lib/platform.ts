/**
 * Utility to check if the application is running in a desktop environment (Electron)
 */
export function isElectron(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check user agent for Electron
  const userAgent = window.navigator.userAgent.toLowerCase();
  if (userAgent.indexOf(' electron/') > -1) {
    return true;
  }
  
  // Check if standard Electron object exists safely
  if (
    typeof window !== 'undefined' &&
    (window as any).process?.versions?.electron
  ) {
    return true;
  }
  
  // Check custom window API flag set by preload script
  if ((window as any).isElectron || (window as any).myElectronAPI) {
    return true;
  }
  
  return false;
}

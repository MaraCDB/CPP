export interface NotificationTargetData {
  bookingId?: string;
  taskId?: string;
}

/**
 * Builds the app URL to open when a reminder notification is clicked.
 * @param scope Absolute service worker registration scope, ending with `/`.
 */
export const buildNotificationUrl = (scope: string, data: NotificationTargetData | undefined): string =>
  `${scope}?booking=${data?.bookingId ?? ''}&task=${data?.taskId ?? ''}`;

/**
 * Finds the first open window that belongs to the app scope.
 * @param scope Absolute service worker registration scope, ending with `/`.
 */
export const findWindowInScope = <T extends { url: string }>(windows: readonly T[], scope: string): T | undefined =>
  windows.find(w => w.url.startsWith(scope));

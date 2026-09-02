export const NOTIFICATIONS_QUEUE = 'notifications-dispatch';

// BullMQ'nun kendi attempts/backoff mekanizması ile eşleşmesi gerekiyor —
// bkz. NotificationsProcessor'ın son deneme kontrolü.
export const NOTIFICATION_JOB_ATTEMPTS = 5;

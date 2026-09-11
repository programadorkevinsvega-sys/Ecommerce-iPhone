export type AdminNotificationsSnapshot = Readonly<{ deliveries: readonly unknown[]; queue: readonly unknown[] }>;
export interface AdminNotificationsQuery { execute(limit: number): Promise<AdminNotificationsSnapshot>; }

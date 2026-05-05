/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';
import { openDB } from 'idb';
import type { BookingTask } from './types';
import { pickToNotify } from './lib/reminders/pickToNotify';

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('install', () => {
  void self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

const DB = 'cdb_cache';
const VERSION = 2;

const readTasks = async (): Promise<BookingTask[]> => {
  const db = await openDB(DB, VERSION);
  const arr = (await db.get('tasks', 'all')) as BookingTask[] | undefined;
  return arr || [];
};

const writeTasks = async (items: BookingTask[]) => {
  const db = await openDB(DB, VERSION);
  await db.put('tasks', items, 'all');
};

interface PeriodicSyncEvent extends ExtendableEvent {
  tag: string;
}

self.addEventListener('periodicsync', (event: Event) => {
  const e = event as PeriodicSyncEvent;
  if (e.tag !== 'check-overdue-tasks') return;
  e.waitUntil((async () => {
    const tasks = await readTasks();
    const overdue = pickToNotify(tasks, new Date());
    if (overdue.length === 0) return;
    const nowIso = new Date().toISOString();
    for (const t of overdue) {
      await self.registration.showNotification(t.title, {
        body: t.notes,
        tag: t.id,
        data: { bookingId: t.bookingId, taskId: t.id },
      });
    }
    const updated = tasks.map(t => {
      if (overdue.some(o => o.id === t.id)) {
        return { ...t, notificationStatus: 'shown' as const, notificationShownAt: nowIso };
      }
      return t;
    });
    await writeTasks(updated);
  })());
});

self.addEventListener('notificationclick', (event) => {
  const e = event as NotificationEvent;
  const data = e.notification.data as { bookingId?: string; taskId?: string } | undefined;
  e.notification.close();
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const url = `/CPP/?booking=${data?.bookingId ?? ''}&task=${data?.taskId ?? ''}`;
    const existing = wins.find(w => w.url.includes('/CPP/'));
    if (existing) {
      await existing.focus();
      existing.postMessage({ type: 'open-task', bookingId: data?.bookingId, taskId: data?.taskId });
    } else {
      await self.clients.openWindow(url);
    }
  })());
});

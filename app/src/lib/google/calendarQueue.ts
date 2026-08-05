const KEY = 'cdb_calendar_queue';

export interface CalendarQueueOp {
  kind: 'booking' | 'closure';
  id: string;
  action: 'upsert' | 'delete';
}

type QueueMap = Record<string, CalendarQueueOp>;

const read = (): QueueMap => {
  const raw = localStorage.getItem(KEY);
  if (!raw) return {};
  try { return JSON.parse(raw) as QueueMap; } catch { return {}; }
};

const write = (map: QueueMap): void => {
  localStorage.setItem(KEY, JSON.stringify(map));
};

const keyOf = (kind: CalendarQueueOp['kind'], id: string): string => `${kind}:${id}`;

export const enqueue = (kind: CalendarQueueOp['kind'], id: string, action: CalendarQueueOp['action']): void => {
  const map = read();
  map[keyOf(kind, id)] = { kind, id, action };
  write(map);
};

export const listQueue = (): CalendarQueueOp[] => Object.values(read());

export const removeFromQueue = (kind: CalendarQueueOp['kind'], id: string): void => {
  const map = read();
  delete map[keyOf(kind, id)];
  write(map);
};

export const clearQueue = (): void => localStorage.removeItem(KEY);

export interface PlaceholderData {
  numOspiti?: number;
  adulti?: number;
  bambini?: number;
  oraArrivo?: string;
}

const KNOWN: Record<string, (d: PlaceholderData) => string> = {
  '{adulti}': (d) => String(d.adulti ?? d.numOspiti ?? 0),
  '{bambini}': (d) => String(d.bambini ?? 0),
  '{oraArrivo}': (d) => d.oraArrivo ?? '—',
};

export const resolvePlaceholders = (tpl: string, data: PlaceholderData): string => {
  let out = tpl;
  for (const [key, fn] of Object.entries(KNOWN)) {
    out = out.split(key).join(fn(data));
  }
  return out;
};

export const BOAT_SIZE_OPTIONS = [
  { value: '15-19', label: '15-19 ft' },
  { value: '20-24', label: '20-24 ft' },
  { value: '25-30', label: '25-30 ft' },
  { value: '31-40', label: '31-40 ft' },
] as const;

export const FISH_TARGET_OPTIONS = [
  { value: 'general', label: 'General recommendation' },
  { value: 'cod', label: 'Cod (Torsk)' },
  { value: 'saithe', label: 'Saithe/Coalfish (Sei)' },
  { value: 'haddock', label: 'Haddock (Hyse)' },
  { value: 'mackerel', label: 'Mackerel (Makrell)' },
  { value: 'pollock', label: 'Pollock (Lyr)' },
  { value: 'halibut', label: 'Halibut (Kveite)' },
  { value: 'ling', label: 'Ling (Lange)' },
  { value: 'tusk', label: 'Tusk (Brosme)' },
  { value: 'monkfish', label: 'Monkfish (Breiflabb)' },
  { value: 'wolffish', label: 'Wolffish (Steinbit)' },
  { value: 'redfish', label: 'Redfish (Uer)' },
  { value: 'plaice', label: 'Plaice (Rødspette)' },
  { value: 'hake', label: 'Hake (Lysing)' },
] as const;

export const FISHING_METHOD_OPTIONS = [
  { value: 'trolling', label: 'Trolling' },
  { value: 'same-spot', label: 'Fishing on same spot' },
  { value: 'net', label: 'Fishing with net' },
  { value: 'pot', label: 'Fish pot on bottom' },
] as const;

export type BoatSizePreset = (typeof BOAT_SIZE_OPTIONS)[number]['value'];
export type FishTarget = (typeof FISH_TARGET_OPTIONS)[number]['value'];
export type FishingMethod = (typeof FISHING_METHOD_OPTIONS)[number]['value'];

export interface TuningSelection {
  boat: BoatSizePreset;
  fish: FishTarget;
  method: FishingMethod;
}

export const DEFAULT_TUNING: TuningSelection = {
  boat: '20-24',
  fish: 'general',
  method: 'same-spot',
};

export function parseBoatSize(value: string | undefined): BoatSizePreset | undefined {
  return BOAT_SIZE_OPTIONS.some((o) => o.value === value) ? (value as BoatSizePreset) : undefined;
}

export function parseFishTarget(value: string | undefined): FishTarget | undefined {
  return FISH_TARGET_OPTIONS.some((o) => o.value === value) ? (value as FishTarget) : undefined;
}

export function parseFishingMethod(value: string | undefined): FishingMethod | undefined {
  return FISHING_METHOD_OPTIONS.some((o) => o.value === value) ? (value as FishingMethod) : undefined;
}

export function getTuningLabels(selection: TuningSelection): { boat: string; fish: string; method: string } {
  return {
    boat: BOAT_SIZE_OPTIONS.find((o) => o.value === selection.boat)?.label ?? selection.boat,
    fish: FISH_TARGET_OPTIONS.find((o) => o.value === selection.fish)?.label ?? selection.fish,
    method: FISHING_METHOD_OPTIONS.find((o) => o.value === selection.method)?.label ?? selection.method,
  };
}

export function parseTuningFromSearchParams(params: { boat?: string; fish?: string; method?: string }): Partial<TuningSelection> {
  return {
    boat: parseBoatSize(params.boat),
    fish: parseFishTarget(params.fish),
    method: parseFishingMethod(params.method),
  };
}

export function sanitizeTuningSelection(raw: Partial<TuningSelection> | undefined): Partial<TuningSelection> {
  if (!raw) {return {};}
  return {
    boat: parseBoatSize(raw.boat),
    fish: parseFishTarget(raw.fish),
    method: parseFishingMethod(raw.method),
  };
}

export function resolveTuningSelection(params: Partial<TuningSelection>, localFallback?: Partial<TuningSelection>): TuningSelection {
  const local = sanitizeTuningSelection(localFallback);
  const url = sanitizeTuningSelection(params);

  return {
    boat: url.boat ?? local.boat ?? DEFAULT_TUNING.boat,
    fish: url.fish ?? local.fish ?? DEFAULT_TUNING.fish,
    method: url.method ?? local.method ?? DEFAULT_TUNING.method,
  };
}

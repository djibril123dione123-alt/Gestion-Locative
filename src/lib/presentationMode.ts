const PRESENTATION_PARAM = 'presentation';

export function isPresentationMode(...searchValues: Array<string | null | undefined>): boolean {
  return searchValues.some((search) => {
    if (!search) return false;

    const value = new URLSearchParams(search).get(PRESENTATION_PARAM)?.trim().toLowerCase();
    return value === '1' || value === 'true' || value === 'on';
  });
}

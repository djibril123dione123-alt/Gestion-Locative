/* eslint-disable @typescript-eslint/no-explicit-any */
if (typeof window === 'undefined') {
  (global as any).window = {
    fetch: () => Promise.resolve(),
    location: { search: '', pathname: '', hash: '' }
  };
}

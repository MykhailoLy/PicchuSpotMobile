export const colors = {
  navy: '#071A2B',
  ivory: '#F4EFE8',
  gold: '#C7A94E',
  line: '#DED3C6',
  white: '#FFFFFF',
  muted: '#AEB8BF',
  danger: '#FFD1D1',
} as const;

export const ZOOM_STEP = 0.1;
export const MAX_TEST_ZOOM = 0.5;

export type LastCapture = {
  uri: string;
  width: number;
  height: number;
  byteSize: number | null;
};

export function formatFileSize(byteSize: number | null) {
  if (!byteSize) {
    return 'size unavailable';
  }

  return `${(byteSize / (1024 * 1024)).toFixed(1)} MB`;
}

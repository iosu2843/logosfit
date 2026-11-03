import { getCloudSession } from '../cloud';
import { createHttpScannerProvider, ScannerError, type FoodScannerProvider, type PreparedImage } from './scanner';

const scannerUrl = (import.meta.env.VITE_FOOD_SCANNER_URL as string | undefined)?.trim();

export const isScannerConfigured = Boolean(scannerUrl);

/** Devuelve el proveedor configurado o null. La clave del modelo de IA vive solo en el backend. */
export function getScannerProvider(): FoodScannerProvider | null {
  if (!scannerUrl) return null;
  return createHttpScannerProvider({
    url: scannerUrl,
    getToken: async () => (await getCloudSession())?.access_token ?? null,
  });
}

const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_SIDE = 1280;

/** Valida y reduce la imagen en el dispositivo antes de enviarla (menos datos, menos latencia). */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!allowedTypes.includes(file.type)) throw new ScannerError('invalid-response', 'Formato no admitido. Usa JPG, PNG o WebP.');
  if (file.size > MAX_FILE_BYTES) throw new ScannerError('too-large', 'La imagen supera los 15 MB.');

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new ScannerError('invalid-response', 'No se pudo procesar la imagen.');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return { base64: dataUrl.slice(dataUrl.indexOf(',') + 1), mimeType: 'image/jpeg' };
}

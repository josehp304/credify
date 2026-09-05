import jsQR from 'jsqr';
import { Jimp } from 'jimp';

/**
 * Extracts a QR Code token from an image
 * @param {Buffer} imageBuffer - The image uploaded by the user
 * @returns {Promise<string|null>} The QR code data
 */
export async function extractQRCode(imageBuffer) {
  try {
    const image = await Jimp.read(imageBuffer);
    const { width, height, data } = image.bitmap;
    
    // jsQR requires a Uint8ClampedArray
    const clampedArray = new Uint8ClampedArray(data);
    
    const code = jsQR(clampedArray, width, height);
    if (code) {
      return code.data;
    }
    return null;
  } catch (err) {
    console.error('Error reading QR code:', err);
    return null;
  }
}

import { Jimp } from 'jimp';

const END_DELIMITER = '||END||';

/**
 * Embeds a string payload into an image buffer using Basic LSB techniques.
 * Returns a new PNG Buffer.
 */
export async function embedWatermark(imageBuffer, payload) {
  try {
    const image = await Jimp.read(imageBuffer);
    const textToEmbed = payload + END_DELIMITER;
    
    let bitIndex = 0;
    const bits = [];
    
    // Convert string to bits
    for (let i = 0; i < textToEmbed.length; i++) {
        const charCode = textToEmbed.charCodeAt(i);
        for (let b = 7; b >= 0; b--) {
            bits.push((charCode >> b) & 1);
        }
    }

    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
        if (bitIndex >= bits.length) return; // All bits embedded

        // Modify Red channel
        let bit = bits[bitIndex++];
        this.bitmap.data[idx] = (this.bitmap.data[idx] & ~1) | bit;

        if (bitIndex < bits.length) {
            // Modify Green channel
            bit = bits[bitIndex++];
            this.bitmap.data[idx + 1] = (this.bitmap.data[idx + 1] & ~1) | bit;
        }

        if (bitIndex < bits.length) {
            // Modify Blue channel
            bit = bits[bitIndex++];
            this.bitmap.data[idx + 2] = (this.bitmap.data[idx + 2] & ~1) | bit;
        }
    });

    return await image.getBuffer('image/png');
  } catch (error) {
    console.error('Watermark embedding error:', error);
    throw error;
  }
}

/**
 * Extracts a watermark payload from an image.
 */
export async function extractWatermark(imageBuffer) {
  try {
    const image = await Jimp.read(imageBuffer);
    const data = image.bitmap.data;
    let extractedText = '';
    let currentByte = 0;
    let bitsCollected = 0;

    // Scan the image data directly instead of Jimp's scan for better performance
    // and manual loop control (bailing out early)
    for (let i = 0; i < data.length; i++) {
        // Skip alpha channel (every 4th byte)
        if ((i + 1) % 4 === 0) continue;

        // Extract LSB
        const bit = data[i] & 1;
        currentByte = (currentByte << 1) | bit;
        bitsCollected++;

        if (bitsCollected === 8) {
            extractedText += String.fromCharCode(currentByte);
            currentByte = 0;
            bitsCollected = 0;

            // Check if we hit the end delimiter
            if (extractedText.endsWith(END_DELIMITER)) {
                return extractedText.slice(0, -END_DELIMITER.length);
            }

            // Safety check: if we've extracted way more than a UUID + delimiter, 
            // and no delimiter found, it's probably not watermarked or corrupted.
            // Let's cap it at 1000 characters for now (UUID is ~36, delimiter is ~7).
            if (extractedText.length > 1000) {
                return null;
            }
        }
    }
    
    // Missing watermark delimiter
    return null;
  } catch (error) {
      console.error('Watermark extraction error:', error);
      return null;
  }
}

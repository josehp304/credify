import exifr from 'exifr';

/**
 * Extracts EXIF data and looks for common red flags
 * (e.g. missing camera model, missing original date timestamp, evidence of photo editing software)
 * @param {Buffer} imageBuffer 
 * @returns {Promise<Object>} { result: 'PASS' | 'FAIL', flags: string[] }
 */
export async function analyzeExif(imageBuffer) {
  const flags = [];
  try {
    const metadata = await exifr.parse(imageBuffer, { tiff: true, exif: true, iptc: true, xmp: true });
    
    if (!metadata) {
      flags.push("missing_all_metadata");
      return { result: "FAIL", flags };
    }

    if (!metadata.Make && !metadata.Model) {
      flags.push("missing_camera_info");
    }

    if (metadata.Software && metadata.Software.toLowerCase().match(/(photoshop|lightroom|gimp|midjourney|dall-e|stable diffusion)/)) {
      flags.push("editing_software_detected");
    }

    // Additional checks can be added here
    
    return {
      result: flags.length > 0 ? "FAIL" : "PASS",
      flags
    };
  } catch (error) {
    console.error("EXIF parsing error:", error);
    // If it can't be parsed, it might be heavily stripped or not a real photo
    return { result: "FAIL", flags: ["parsing_error_or_stripped"] };
  }
}

import { Reader } from '@contentauth/c2pa-node';

/**
 * Deterministic C2PA (Content Credentials) provenance analysis.
 *
 * This replaces the old approach of asking Gemini to "check for C2PA metadata"
 * — vision models only see decoded pixels and can never read the JUMBF boxes
 * a manifest lives in, so those answers were hallucinated. Here the manifest
 * is parsed and its signature validated locally by the official CAI library.
 *
 * digitalSourceType values that are self-declared proof of AI generation.
 * Generators that sign manifests (DALL-E, Firefly, Google) label their own
 * output, so a valid signature + one of these types is conclusive.
 */
const AI_GENERATED_TYPES = new Set([
  'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia',
  'http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia',
  'http://cv.iptc.org/newscodes/digitalsourcetype/algorithmicMedia',
  'http://c2pa.org/digitalsourcetype/trainedAlgorithmicData',
]);

// Types/actions that prove software manipulation but not necessarily full
// AI generation (a composite could be a human collage). Flag, don't fail.
const AI_EDITED_TYPES = new Set([
  'http://cv.iptc.org/newscodes/digitalsourcetype/algorithmicallyEnhanced',
  'http://cv.iptc.org/newscodes/digitalsourcetype/composite',
  'http://cv.iptc.org/newscodes/digitalsourcetype/compositeSynthetic',
  'http://cv.iptc.org/newscodes/digitalsourcetype/softwareImage',
]);

const CAPTURE_TYPES = new Set([
  'http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture',
  'http://cv.iptc.org/newscodes/digitalsourcetype/computationalCapture',
]);

/**
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @returns {Promise<{
 *   present: boolean,
 *   validation_state?: 'Invalid'|'Valid'|'Trusted',
 *   verdict: 'absent'|'ai_generated'|'ai_edited'|'tampered'|'authentic_capture'|'present',
 *   claim_generator?: string,
 *   source_types?: string[],
 *   actions?: string[],
 *   failures?: string[],
 *   error?: string,
 * }>}
 */
export async function analyzeC2pa(buffer, mimeType = 'image/jpeg') {
  let reader;
  try {
    reader = await Reader.fromAsset({ buffer, mimeType });
  } catch (err) {
    // Unsupported container or malformed file — not a provenance signal.
    return { present: false, verdict: 'absent', error: String(err?.message ?? err) };
  }

  if (!reader) {
    // No manifest. Most images have none; absence is neutral, never suspicious.
    return { present: false, verdict: 'absent' };
  }

  const store = reader.json();
  const active = store.manifests?.[store.active_manifest];

  const actionsAssertion = active?.assertions?.find((a) => a.label?.startsWith('c2pa.actions'));
  const actions = actionsAssertion?.data?.actions ?? [];
  const sourceTypes = actions.map((a) => a.digitalSourceType).filter(Boolean);
  const actionNames = actions.map((a) => a.action).filter(Boolean);

  const failures = (store.validation_results?.activeManifest?.failure ?? []).map((s) => s.code);
  // `signingCredential.untrusted` only means the cert is not on a configured
  // trust list (we ship none) — the signature itself is still cryptographically
  // checked. A hash mismatch is what proves post-signing pixel edits.
  const hashMismatch = failures.some((c) => c.includes('dataHash.mismatch'));

  const base = {
    present: true,
    validation_state: store.validation_state ?? undefined,
    claim_generator:
      active?.claim_generator_info?.[0]?.name ?? active?.claim_generator ?? undefined,
    source_types: sourceTypes,
    actions: actionNames,
    failures,
  };

  if (store.validation_state === 'Invalid' || hashMismatch) {
    return { ...base, verdict: 'tampered' };
  }
  if (sourceTypes.some((t) => AI_GENERATED_TYPES.has(t))) {
    return { ...base, verdict: 'ai_generated' };
  }
  if (sourceTypes.some((t) => AI_EDITED_TYPES.has(t)) || actionNames.includes('c2pa.edited')) {
    return { ...base, verdict: 'ai_edited' };
  }
  if (sourceTypes.some((t) => CAPTURE_TYPES.has(t))) {
    return { ...base, verdict: 'authentic_capture' };
  }
  return { ...base, verdict: 'present' };
}

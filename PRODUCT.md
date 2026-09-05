# Product

## Register

product

(The app surfaces — dashboard, feature tools, trust canvas — are the primary product.
Marketing surfaces such as `/`, `/trust-database`, and feature landing pages take the
**brand** register per-task.)

## Users

General consumers, not businesses. People who have been burned by, or are wary of,
AI-assisted fraud: fake product reviews, doctored refund photos, forged certificates,
edited ID cards. They sign in with a normal account (Neon Auth), upload something they
doubt, and get a verdict with evidence. No API keys, no integration work; the Chrome
extension works with zero configuration.

## Product Purpose

Credify verifies digital artifacts (images, documents, IDs, review text) for AI
generation and tampering, and feeds every verdict into one persistent Unified Trust
Score per identity. The score is the product's spine: trust is slow to earn (+3) and
fast to lose (-15), so a clean-looking request from a burned identity still gets
flagged. Success looks like a user trusting a Credify verdict more than their own eye.

## Brand Personality

Assured, forensic, plainspoken. The voice of an institution that shows its evidence:
calm, specific, never breathless. Emotional goal for visitors: relief ("someone
serious is on this") rather than excitement. Three words: established, exacting, calm.

## Anti-references

- Crypto/web3 landing pages: neon gradients, glow blobs, floating cards, animated
  tickers, "decentralized network" theatrics.
- Hackathon-demo aesthetics: fabricated stats (2M+ scans/day), terminal cosplay,
  scanner-beam animations.
- Dark-pattern security marketing: fear-first copy, red alerts everywhere.
- Generic SaaS template: centered hero, icon-card grid, gradient text.

## Design Principles

1. **Show the evidence.** The strongest marketing asset is the product's real output:
   evidence reports, score movements, verdicts. Render real mechanics, never invented
   numbers.
2. **Established, not loud.** Restraint executed with precision: hairline rules,
   committed type scale, one accent. Authority comes from composure.
3. **True to the machine.** Copy and visualizations must match the actual backend
   behavior (deltas, thresholds, fallbacks). No claims the code can't cash.
4. **Calm by default, semantic color only where it means something.** Green means
   PASS, red means FAIL, and nowhere else.

## Accessibility & Inclusion

No formal WCAG mandate; target AA contrast on text, honor `prefers-reduced-motion`,
keep all information available without color alone (verdicts always carry text labels).

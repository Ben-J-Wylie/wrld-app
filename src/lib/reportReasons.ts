// The single content/abuse report-reason list, shared across every report surface
// (stream, profile, clip). Each maps to a moderation category server-side
// (categoryFromReason) so the queue triages itself — child-safety first (it
// auto-escalates + drives the NCMEC flow). The report sheets also collect an
// optional free-text detail for specifics (e.g. drugs under "Something else").
// Keep in sync with wrld-web's src/lib/reportReasons.ts.
//
// NOTE: the PPV "delivery problem" report (never started / ended early / …) is a
// SEPARATE thing (escrow review at payout), not this — don't fold it in here.
export const REPORT_REASONS = [
  'Child safety',
  'Nudity or sexual content',
  'Violence or dangerous acts',
  'Self-harm or suicide',
  'Harassment, bullying, or hate',
  'Something else',
]

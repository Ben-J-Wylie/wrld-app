// Fold leetspeak before a bad-words check so disguised words (n1gg3r, sh1t) are
// caught — mirrors wrld-backend/src/lib/profanity.ts + the mediasoup chat gate.
// NOT a word list: just character substitutions that un-disguise text before the
// bad-words library matches it. Spaces are preserved so bad-words still tokenizes
// on word boundaries (no "class" -> "ass" false positive).
export function foldLeetspeak(text: string): string {
  return text
    .toLowerCase()
    .replace(/[1!|]/g, 'i')
    .replace(/3/g, 'e')
    .replace(/[4@]/g, 'a')
    .replace(/0/g, 'o')
    .replace(/[5$]/g, 's')
    .replace(/7/g, 't')
}

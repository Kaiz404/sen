/** Starts a sentence with a word that reads in lower case mid-sentence, like "fingerprint". */
export function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

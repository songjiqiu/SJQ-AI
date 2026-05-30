export const deckInputMaxFileCount = 5;
export const deckInputMaxFileSize = 10 * 1024 * 1024;
export const deckInputMaxFileCharacters = 40000;

export const deckInputFileExtensions = [
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".json",
  ".docx"
] as const;

export const deckInputFileAccept = [
  ...deckInputFileExtensions,
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
].join(",");

export type DeckInputFileExtension = (typeof deckInputFileExtensions)[number];

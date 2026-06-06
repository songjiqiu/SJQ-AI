export const deckInputMaxFileCount = 5;
export const deckInputMaxFileSize = 10 * 1024 * 1024;
export const deckInputMaxFileCharacters = 40000;

export const deckInputFileExtensions = [
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".json",
  ".docx",
  ".pptx",
  ".xlsx",
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".bmp"
] as const;

export const deckInputFileAccept = [
  ...deckInputFileExtensions,
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/bmp"
].join(",");

export type DeckInputFileExtension = (typeof deckInputFileExtensions)[number];

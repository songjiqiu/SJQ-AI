export class ActiveGenerationExistsError extends Error {
  constructor() {
    super("A deck generation task is still running");
    this.name = "ActiveGenerationExistsError";
  }
}

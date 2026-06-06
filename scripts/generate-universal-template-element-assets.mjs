console.error(
  [
    "The old 792-item universal template element asset package has been retired.",
    "Semantic assets now use TemplateAsset plus six typed detail tables.",
    "Use pnpm db:seed:template-assets -- --dry-run to validate the small COMMON/common fallback package."
  ].join("\n")
);

process.exitCode = 1;

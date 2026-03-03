import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const loaderDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(loaderDir, "../..");

function resolveAliasPath(specifier) {
  const relative = specifier.slice(2);
  const basePath = path.join(projectRoot, "src", relative);
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
  ];

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  return found ? pathToFileURL(found).href : null;
}

export async function resolve(specifier, context, defaultResolve) {
  if (specifier.startsWith("@/")) {
    const url = resolveAliasPath(specifier);

    if (!url) {
      throw new Error(`Unable to resolve alias ${specifier}`);
    }

    return {
      url,
      shortCircuit: true,
    };
  }

  return defaultResolve(specifier, context, defaultResolve);
}

import { promises as fs } from "node:fs";
import type { Artifact, ArtifactMap, ContentRow } from "@/types/creator";

export interface ArtifactSpec {
  key: string;
  label: string;
  icon: string;
  resolve: (id: string, dir: string) => Promise<string | null> | string | null;
}

export interface ContentTypeSpec<TMeta> {
  kind: string;
  scan: () => Promise<Array<{ id: string; dir: string }>>;
  artifacts: ArtifactSpec[];
  build: (
    id: string,
    dir: string
  ) => Promise<{ title: string; status: string; meta: TMeta }>;
}

export async function pathExists(p: string | null): Promise<boolean> {
  if (!p) return false;
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function buildArtifactMap(
  id: string,
  dir: string,
  specs: ArtifactSpec[]
): Promise<ArtifactMap> {
  const entries = await Promise.all(
    specs.map(async (spec) => {
      const resolved = await Promise.resolve(spec.resolve(id, dir));
      const exists = await pathExists(resolved);
      const artifact: Artifact = {
        path: resolved ?? "",
        exists,
        label: spec.label,
        icon: spec.icon,
      };
      return [spec.key, artifact] as const;
    })
  );
  const map: ArtifactMap = {};
  for (const [key, artifact] of entries) {
    map[key] = artifact;
  }
  return map;
}

export async function scanContent<TMeta>(
  spec: ContentTypeSpec<TMeta>
): Promise<ContentRow<TMeta>[]> {
  const items = await spec.scan();
  const rows = await Promise.all(
    items.map(async ({ id, dir }) => {
      const [artifacts, built] = await Promise.all([
        buildArtifactMap(id, dir, spec.artifacts),
        spec.build(id, dir),
      ]);
      const row: ContentRow<TMeta> = {
        id,
        title: built.title,
        status: built.status,
        folderPath: dir,
        artifacts,
        meta: built.meta,
      };
      return row;
    })
  );
  return rows;
}

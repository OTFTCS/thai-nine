import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import type { ValidationIssue } from "./types.ts";

type Schema = {
  type?: string | string[];
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  enum?: unknown[];
  const?: unknown;
  minItems?: number;
  maxItems?: number;
  minimum?: number;
  pattern?: string;
  additionalProperties?: boolean;
};

export interface SchemaTarget {
  path: string;
  schemaFile: string;
  required?: boolean;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function getSchemaRoot(root: string): string {
  return join(root, "course", "schemas");
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function matchesType(value: unknown, expected: string): boolean {
  if (expected === "array") return Array.isArray(value);
  if (expected === "null") return value === null;
  return typeof value === expected;
}

function validateValue(value: unknown, schema: Schema, atPath: string): string[] {
  const errors: string[] = [];

  if (schema.const !== undefined && value !== schema.const) {
    errors.push(`${atPath}: expected constant value ${JSON.stringify(schema.const)}`);
    return errors;
  }

  if (schema.enum && !schema.enum.some((v) => JSON.stringify(v) === JSON.stringify(value))) {
    errors.push(`${atPath}: expected one of ${schema.enum.map((v) => JSON.stringify(v)).join(", ")}`);
    return errors;
  }

  if (schema.type) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!allowed.some((t) => matchesType(value, t))) {
      errors.push(`${atPath}: expected type ${allowed.join("|")}`);
      return errors;
    }
  }

  if (typeof value === "string" && schema.pattern) {
    const regex = new RegExp(schema.pattern);
    if (!regex.test(value)) {
      errors.push(`${atPath}: does not match pattern ${schema.pattern}`);
    }
  }

  if (typeof value === "number" && schema.minimum !== undefined && value < schema.minimum) {
    errors.push(`${atPath}: must be >= ${schema.minimum}`);
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${atPath}: must contain at least ${schema.minItems} items`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(`${atPath}: must contain no more than ${schema.maxItems} items`);
    }
    if (schema.items) {
      value.forEach((item, idx) => {
        errors.push(...validateValue(item, schema.items as Schema, `${atPath}[${idx}]`));
      });
    }
  }

  if (isRecord(value)) {
    const required = schema.required ?? [];
    for (const req of required) {
      if (!(req in value)) errors.push(`${atPath}.${req}: is required`);
    }

    const properties = schema.properties ?? {};
    for (const [key, propSchema] of Object.entries(properties)) {
      if (key in value) {
        errors.push(...validateValue(value[key], propSchema, `${atPath}.${key}`));
      }
    }

    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) {
          errors.push(`${atPath}.${key}: additional property is not allowed`);
        }
      }
    }
  }

  return errors;
}

function validateJsonFileWithSchema(path: string, schemaPath: string): string[] {
  try {
    const data = readJson(path);
    const schema = readJson(schemaPath) as Schema;
    return validateValue(data, schema, "$data");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [`${path}: ${message}`];
  }
}

export function validateSchemaTargets(root: string, targets: SchemaTarget[]): ValidationIssue[] {
  const schemaRoot = getSchemaRoot(root);
  const issues: ValidationIssue[] = [];

  for (const target of targets) {
    const filePath = isAbsolute(target.path) ? target.path : join(root, target.path);
    if (!existsSync(filePath)) {
      if (target.required !== false) {
        issues.push({ path: filePath, message: "Required schema-validated file is missing" });
      }
      continue;
    }

    const schemaPath = join(schemaRoot, target.schemaFile);
    if (!existsSync(schemaPath)) {
      issues.push({ path: schemaPath, message: "Schema file missing" });
      continue;
    }

    const schemaErrors = validateJsonFileWithSchema(filePath, schemaPath);
    for (const err of schemaErrors) {
      issues.push({ path: filePath, message: err.replace(/^\$data\.?/, "") });
    }
  }

  return issues;
}

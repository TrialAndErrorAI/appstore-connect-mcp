/**
 * OpenAPI Spec Loader for Code Mode
 *
 * Loads Apple's official OpenAPI spec and pre-resolves $refs
 * so agent-generated code can traverse it without following references.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ResolvedSpec {
  info: { title: string; version: string };
  paths: Record<string, any>;
  pathCount: number;
  schemaCount: number;
}

/**
 * Load and resolve the OpenAPI spec.
 * Resolves all $ref pointers inline so generated code can traverse freely.
 */
export function loadSpec(): ResolvedSpec {
  const rawPath = join(__dirname, 'openapi.json');
  const raw = JSON.parse(readFileSync(rawPath, 'utf-8'));

  const schemas = raw.components?.schemas || {};

  // Resolve $ref pointers inline (one level deep — sufficient for search)
  const paths: Record<string, any> = {};

  for (const [path, methods] of Object.entries(raw.paths as Record<string, any>)) {
    paths[path] = {};
    for (const [method, operation] of Object.entries(methods as Record<string, any>)) {
      if (method === 'parameters') continue; // skip path-level params

      paths[path][method] = {
        summary: operation.summary || '',
        description: operation.description || '',
        operationId: operation.operationId || '',
        tags: operation.tags || [],
        parameters: (operation.parameters || []).map((p: any) => {
          if (p.$ref) {
            return resolveRef(p.$ref, raw);
          }
          return {
            name: p.name,
            in: p.in,
            required: p.required || false,
            description: p.description || '',
            schema: resolveSchemaShallow(p.schema, schemas)
          };
        }),
        requestBody: operation.requestBody
          ? summarizeRequestBody(operation.requestBody, schemas)
          : undefined,
        responses: summarizeResponses(operation.responses || {}, schemas)
      };
    }
  }

  return {
    info: raw.info,
    paths,
    pathCount: Object.keys(paths).length,
    schemaCount: Object.keys(schemas).length
  };
}

/**
 * Resolve a $ref pointer to its target
 */
function resolveRef(ref: string, root: any): any {
  const parts = ref.replace('#/', '').split('/');
  let current = root;
  for (const part of parts) {
    current = current?.[part];
    if (!current) return { $ref: ref, _unresolved: true };
  }
  return current;
}

/**
 * Resolve schema one level deep (type + properties, not full tree)
 */
function resolveSchemaShallow(schema: any, schemas: Record<string, any>): any {
  if (!schema) return undefined;

  if (schema.$ref) {
    const name = schema.$ref.split('/').pop();
    const resolved = schemas[name!];
    if (!resolved) return { type: 'unknown', ref: name };
    return {
      type: resolved.type || 'object',
      properties: resolved.properties
        ? Object.fromEntries(
            Object.entries(resolved.properties).map(([k, v]: [string, any]) => [
              k,
              { type: v.type || (v.$ref ? 'object' : 'unknown'), description: v.description || '' }
            ])
          )
        : undefined,
      enum: resolved.enum,
      description: resolved.description
    };
  }

  if (schema.type === 'array' && schema.items) {
    return {
      type: 'array',
      items: resolveSchemaShallow(schema.items, schemas)
    };
  }

  return schema;
}

/**
 * Summarize request body (type + required fields, not full schema)
 */
function summarizeRequestBody(body: any, schemas: Record<string, any>): any {
  const content = body.content?.['application/json'];
  if (!content?.schema) return { description: body.description || '' };

  return {
    required: body.required || false,
    schema: resolveSchemaShallow(content.schema, schemas)
  };
}

/**
 * Summarize responses (status codes + descriptions, not full schemas)
 */
function summarizeResponses(responses: Record<string, any>, schemas: Record<string, any>): any {
  const result: Record<string, any> = {};
  for (const [status, resp] of Object.entries(responses)) {
    const content = (resp as any).content?.['application/json'];
    result[status] = {
      description: (resp as any).description || '',
      schema: content?.schema ? resolveSchemaShallow(content.schema, schemas) : undefined
    };
  }
  return result;
}

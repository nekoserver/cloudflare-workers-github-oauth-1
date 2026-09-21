#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const CARDINALITY = Object.freeze({
  one: { minimum: 0, maximum: 1 },
  many: { minimum: 0, maximum: null },
  exec: { minimum: 0, maximum: 0 },
  execrows: { minimum: 0, maximum: 0 },
  execlastid: { minimum: 0, maximum: 0 },
  execresult: { minimum: 0, maximum: 0 },
  batchexec: { minimum: 0, maximum: 0 },
  batchone: { minimum: 0, maximum: 1 },
  batchmany: { minimum: 0, maximum: null },
  copyfrom: { minimum: 0, maximum: 0 },
});

function boolField(value, camel, snake) {
  if (typeof value?.[camel] === 'boolean') return value[camel];
  if (typeof value?.[snake] === 'boolean') return value[snake];
  return null;
}

function normalizeCommand(command) {
  const value = String(command || '').replace(/^:/, '').toLowerCase();
  return value ? `:${value}` : '';
}

function normalizeColumn(column, index, parameter) {
  const value = column || {};
  const notNull = boolField(value, 'notNull', 'not_null');
  const tableName = value.table?.name || '';
  const name = value.name || `${parameter ? 'param' : 'column'}_${index + 1}`;
  return {
    name,
    ...(parameter ? {} : { source: tableName ? `${tableName}.${value.name || name}` : null }),
    databaseType: value.type || value.databaseType || value.database_type || 'unknown',
    nullable: notNull === null ? null : !notNull,
  };
}

function buildSqlcIr(request) {
  if (!request || !Array.isArray(request.queries)) {
    throw new TypeError('CodegenRequestのqueries配列が必要です');
  }

  return {
    version: 1,
    source: 'sqlc-codegen-request',
    engine: request.settings?.engine || request.sqlcVersion?.engine || null,
    queries: request.queries.map((query) => {
      const command = normalizeCommand(query.cmd || query.command);
      const commandName = command.slice(1);
      return {
        name: query.name || '',
        command,
        cardinality: CARDINALITY[commandName] || { minimum: null, maximum: null },
        filename: query.filename || null,
        parameters: (query.params || []).map((param, index) =>
          normalizeColumn(param.column || param, index, true)),
        resultColumns: (query.columns || []).map((column, index) =>
          normalizeColumn(column, index, false)),
      };
    }),
  };
}

function finding(code, query, detail) {
  return { code, query, detail };
}

function compareSqlcIr(baseline, current) {
  const breaking = [];
  const nonBreaking = [];
  const currentByName = new Map(current.queries.map((query) => [query.name, query]));

  for (const before of baseline.queries) {
    const after = currentByName.get(before.name);
    if (!after) {
      breaking.push(finding('QUERY_REMOVED', before.name, 'queryが削除されました'));
      continue;
    }
    if (before.command !== after.command) {
      breaking.push(finding('COMMAND_CHANGED', before.name, `${before.command} -> ${after.command}`));
    }

    const beforeParams = new Map(before.parameters.map((param) => [param.name, param]));
    for (const parameter of after.parameters) {
      const oldParameter = beforeParams.get(parameter.name);
      if (!oldParameter) {
        const item = finding(
          parameter.nullable === true ? 'NULLABLE_PARAMETER_ADDED' : 'REQUIRED_PARAMETER_ADDED',
          before.name,
          parameter.name,
        );
        (parameter.nullable === true ? nonBreaking : breaking).push(item);
      } else if (oldParameter.databaseType !== parameter.databaseType) {
        breaking.push(finding('PARAMETER_TYPE_CHANGED', before.name, `${parameter.name}: ${oldParameter.databaseType} -> ${parameter.databaseType}`));
      } else if (oldParameter.nullable === true && parameter.nullable === false) {
        breaking.push(finding('PARAMETER_BECAME_REQUIRED', before.name, parameter.name));
      }
    }

    const resultCount = Math.max(before.resultColumns.length, after.resultColumns.length);
    for (let index = 0; index < resultCount; index += 1) {
      const oldColumn = before.resultColumns[index];
      const newColumn = after.resultColumns[index];
      if (!oldColumn || !newColumn) {
        breaking.push(finding('RESULT_SHAPE_CHANGED', before.name, `結果列数: ${before.resultColumns.length} -> ${after.resultColumns.length}`));
        break;
      }
      if (oldColumn.databaseType !== newColumn.databaseType) {
        breaking.push(finding('RESULT_TYPE_CHANGED', before.name, `${oldColumn.name}: ${oldColumn.databaseType} -> ${newColumn.databaseType}`));
      } else if (oldColumn.name !== newColumn.name || oldColumn.nullable !== newColumn.nullable) {
        breaking.push(finding('RESULT_COLUMN_CHANGED', before.name, `${oldColumn.name} -> ${newColumn.name}`));
      }
    }
  }

  const baselineNames = new Set(baseline.queries.map((query) => query.name));
  for (const query of current.queries) {
    if (!baselineNames.has(query.name)) {
      nonBreaking.push(finding('QUERY_ADDED', query.name, 'queryが追加されました'));
    }
  }
  return { breaking, nonBreaking };
}

function escapeCell(value) {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function describeField(field) {
  const nullable = field.nullable === true ? ' | null' : field.nullable === null ? ' | nullability不明' : '';
  return `${field.name}: ${field.databaseType}${nullable}`;
}

function formatSqlcIrMarkdown(ir) {
  const lines = [
    '| query | command | cardinality | parameters | result |',
    '|---|---|---|---|---|',
  ];
  for (const query of ir.queries) {
    const max = query.cardinality.maximum === null ? '*' : query.cardinality.maximum;
    lines.push(`| ${escapeCell(query.name)} | ${escapeCell(query.command)} | ${query.cardinality.minimum}..${max} | ${escapeCell(query.parameters.map(describeField).join(', '))} | ${escapeCell(query.resultColumns.map(describeField).join(', '))} |`);
  }
  return `${lines.join('\n')}\n`;
}

function parseArguments(argv) {
  const options = { format: 'json' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input') options.input = argv[++index];
    else if (arg === '--baseline') options.baseline = argv[++index];
    else if (arg === '--format') options.format = argv[++index];
    else throw new Error(`不明な引数です: ${arg}`);
  }
  if (!options.input) throw new Error('--input <codegen_request.json> が必要です');
  if (!['json', 'markdown'].includes(options.format)) throw new Error('--formatはjsonまたはmarkdownを指定してください');
  return options;
}

function runCli(argv) {
  const options = parseArguments(argv);
  const current = buildSqlcIr(JSON.parse(fs.readFileSync(options.input, 'utf8')));
  const diff = options.baseline
    ? compareSqlcIr(buildSqlcIr(JSON.parse(fs.readFileSync(options.baseline, 'utf8'))), current)
    : null;
  const output = options.format === 'markdown'
    ? formatSqlcIrMarkdown(current)
    : `${JSON.stringify(diff ? { ir: current, diff } : current, null, 2)}\n`;
  process.stdout.write(output);
  return diff?.breaking.length ? 2 : 0;
}

if (require.main === module) {
  try {
    process.exitCode = runCli(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`sqlc-codegen-ir: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { buildSqlcIr, compareSqlcIr, formatSqlcIrMarkdown, runCli };

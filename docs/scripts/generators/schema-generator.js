/**
 * Database Schema Documentation Generator
 *
 * Generates comprehensive database schema documentation including:
 * - Entity relationship diagrams
 * - Table structures
 * - Migration history
 * - Relationships and constraints
 */

const fs = require('fs');
const path = require('path');

/**
 * Generate database schema documentation
 */
async function generateSchemaDocs(config) {
  const entitiesDir = path.join(config.tauriDir, 'src/database/entities');
  const migrationsDir = path.join(config.tauriDir, 'src/database/migration');

  if (!fs.existsSync(entitiesDir)) {
    throw new Error(`Entities directory not found: ${entitiesDir}`);
  }

  // Extract schema information
  const entities = await extractEntities(entitiesDir);
  const migrations = await extractMigrations(migrationsDir);
  const relationships = extractRelationships(entities);

  // Generate documentation
  const markdownContent = generateSchemaMarkdown(
    entities,
    migrations,
    relationships
  );

  // Generate Mermaid ERD
  const mermaidERD = generateMermaidERD(entities, relationships);

  // Write documentation files
  const schemaFile = path.join(config.outputDir, 'database-schema.md');
  const erdFile = path.join(config.outputDir, 'database-erd.md');

  fs.writeFileSync(schemaFile, markdownContent);
  fs.writeFileSync(erdFile, mermaidERD);

  console.log(`✅ Generated database schema documentation: ${schemaFile}`);
  console.log(`✅ Generated database ERD: ${erdFile}`);

  return { entities, migrations, relationships };
}

/**
 * Extract entity information from Rust files
 */
async function extractEntities(entitiesDir) {
  const entities = {};
  const entityFiles = fs
    .readdirSync(entitiesDir)
    .filter(f => f.endsWith('.rs') && f !== 'mod.rs');

  entityFiles.forEach(file => {
    const filePath = path.join(entitiesDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    const entity = parseEntityFile(content, file);
    if (entity) {
      entities[entity.name] = entity;
    }
  });

  return entities;
}

/**
 * Parse a single entity file
 */
function parseEntityFile(content, filename) {
  // Extract table name
  const tableNameMatch = content.match(
    /#\[sea_orm\(table_name = "([^"]+)"\)\]/
  );
  if (!tableNameMatch) return null;

  const tableName = tableNameMatch[1];

  // Extract struct definition
  const structMatch = content.match(/pub struct Model \{([^}]+)\}/s);
  if (!structMatch) return null;

  const fields = parseFields(structMatch[1]);

  // Extract relationships
  const relationshipsMatch = content.match(/enum Relation \{([^}]+)\}/s);
  const relationships = relationshipsMatch
    ? parseRelationships(relationshipsMatch[1])
    : [];

  // Extract comments and documentation
  const docComment = extractEntityDocComment(content);

  return {
    name: tableName,
    filename: filename.replace('.rs', ''),
    fields,
    relationships,
    description: docComment,
  };
}

/**
 * Parse struct fields
 */
function parseFields(fieldsString) {
  const fields = [];
  const fieldLines = fieldsString
    .split('\n')
    .map(line => line.trim())
    .filter(line => line);

  fieldLines.forEach(line => {
    // Skip attributes and comments
    if (
      line.startsWith('#[') ||
      line.startsWith('//') ||
      line.startsWith('/*')
    ) {
      return;
    }

    // Parse field definition: pub field_name: Type,
    const fieldMatch = line.match(/pub\s+(\w+):\s*([^,]+),?/);
    if (fieldMatch) {
      const [, name, type] = fieldMatch;

      // Determine if field is optional
      const isOptional = type.includes('Option<');
      const cleanType = type.replace(/Option<(.+)>/, '$1');

      // Determine if field is primary key
      const isPrimaryKey = name === 'id';

      // Determine if field is foreign key
      const isForeignKey = name.endsWith('_id') && name !== 'id';

      fields.push({
        name,
        type: cleanType,
        optional: isOptional,
        primaryKey: isPrimaryKey,
        foreignKey: isForeignKey,
        description: generateFieldDescription(name, cleanType),
      });
    }
  });

  return fields;
}

/**
 * Parse relationships from enum
 */
function parseRelationships(relationshipsString) {
  const relationships = [];
  const relationLines = relationshipsString
    .split('\n')
    .map(line => line.trim())
    .filter(line => line);

  relationLines.forEach(line => {
    // Parse relationship attributes
    const hasOneMatch = line.match(/#\[sea_orm\(has_one = "([^"]+)"\)\]/);
    const hasManyMatch = line.match(/#\[sea_orm\(has_many = "([^"]+)"\)\]/);
    const belongsToMatch = line.match(
      /#\[sea_orm\(belongs_to = "([^"]+)".*?\)\]/
    );

    if (hasOneMatch) {
      relationships.push({
        type: 'has_one',
        target: hasOneMatch[1],
        description: `Has one ${hasOneMatch[1]}`,
      });
    } else if (hasManyMatch) {
      relationships.push({
        type: 'has_many',
        target: hasManyMatch[1],
        description: `Has many ${hasManyMatch[1]}`,
      });
    } else if (belongsToMatch) {
      relationships.push({
        type: 'belongs_to',
        target: belongsToMatch[1],
        description: `Belongs to ${belongsToMatch[1]}`,
      });
    }
  });

  return relationships;
}

/**
 * Extract entity documentation comment
 */
function extractEntityDocComment(content) {
  const docMatch = content.match(/\/\*\*(.*?)\*\//s);
  if (docMatch) {
    return docMatch[1]
      .split('\n')
      .map(line => line.replace(/^\s*\*\s?/, ''))
      .join('\n')
      .trim();
  }
  return '';
}

/**
 * Generate field description based on name and type
 */
function generateFieldDescription(name, type) {
  const descriptions = {
    id: 'Unique identifier for the record',
    title: 'Title or name of the item',
    description: 'Detailed description',
    created_at: 'Timestamp when the record was created',
    updated_at: 'Timestamp when the record was last updated',
    status: 'Current status of the item',
    priority: 'Priority level',
    due_date: 'Due date for completion',
    scheduled_date: 'Scheduled date for execution',
    start_time: 'Start time of the session',
    end_time: 'End time of the session',
    task_id: 'Reference to the associated task',
    user_id: 'Reference to the user',
    task_list_id: 'Reference to the task list',
  };

  return descriptions[name] || `${name.replace(/_/g, ' ')} field`;
}

/**
 * Extract migration information
 */
async function extractMigrations(migrationsDir) {
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  const migrations = [];
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter(f => f.startsWith('m') && f.endsWith('.rs'))
    .sort();

  migrationFiles.forEach(file => {
    const filePath = path.join(migrationsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    // Extract migration name and description
    const nameMatch = file.match(/m(\d{8}_\d{6})_(.+)\.rs/);
    if (nameMatch) {
      const [, timestamp, description] = nameMatch;

      // Extract up() method to understand what the migration does
      const upMethodMatch = content.match(
        /async fn up\(.*?\) -> Result<.*?> \{(.*?)\}/s
      );
      const operations = upMethodMatch
        ? extractMigrationOperations(upMethodMatch[1])
        : [];

      migrations.push({
        timestamp,
        description: description.replace(/_/g, ' '),
        filename: file,
        operations,
      });
    }
  });

  return migrations;
}

/**
 * Extract migration operations
 */
function extractMigrationOperations(upMethodContent) {
  const operations = [];

  // Look for table creation
  const createTableMatches = upMethodContent.matchAll(/create_table\([^)]+\)/g);
  for (const match of createTableMatches) {
    operations.push({
      type: 'create_table',
      description: 'Create table',
      sql: match[0],
    });
  }

  // Look for index creation
  const createIndexMatches = upMethodContent.matchAll(/create_index\([^)]+\)/g);
  for (const match of createIndexMatches) {
    operations.push({
      type: 'create_index',
      description: 'Create index',
      sql: match[0],
    });
  }

  return operations;
}

/**
 * Extract relationships between entities
 */
function extractRelationships(entities) {
  const relationships = [];

  Object.values(entities).forEach(entity => {
    entity.relationships.forEach(rel => {
      relationships.push({
        from: entity.name,
        to: rel.target.replace(/super::|::Entity/g, ''),
        type: rel.type,
        description: rel.description,
      });
    });
  });

  return relationships;
}

/**
 * Generate schema markdown documentation
 */
function generateSchemaMarkdown(entities, migrations, relationships) {
  let markdown = `# Database Schema Documentation

This document provides comprehensive documentation for the KiraPilot database schema.

*Generated on: ${new Date().toISOString()}*

## Table of Contents

- [Overview](#overview)
- [Tables](#tables)
- [Relationships](#relationships)
- [Migration History](#migration-history)

## Overview

KiraPilot uses SQLite as its database engine with SeaORM as the ORM layer. The database is designed to support:

- Task management with hierarchical relationships
- Time tracking and session management
- AI interaction history
- User preferences and settings
- Productivity analytics and patterns

## Tables

`;

  // Generate table documentation
  Object.values(entities).forEach(entity => {
    markdown += `### ${entity.name}\n\n`;

    if (entity.description) {
      markdown += `${entity.description}\n\n`;
    }

    markdown += `| Column | Type | Nullable | Key | Description |\n`;
    markdown += `|--------|------|----------|-----|-------------|\n`;

    entity.fields.forEach(field => {
      const nullable = field.optional ? '✓' : '✗';
      const key = field.primaryKey ? 'PK' : field.foreignKey ? 'FK' : '';
      markdown += `| ${field.name} | ${field.type} | ${nullable} | ${key} | ${field.description} |\n`;
    });

    markdown += `\n`;

    // Add relationships for this table
    const tableRelationships = relationships.filter(
      r => r.from === entity.name
    );
    if (tableRelationships.length > 0) {
      markdown += `**Relationships:**\n\n`;
      tableRelationships.forEach(rel => {
        markdown += `- ${rel.type.replace(/_/g, ' ')} → ${rel.to}\n`;
      });
      markdown += `\n`;
    }
  });

  // Generate relationships section
  markdown += `## Relationships\n\n`;
  markdown += `The following diagram shows the relationships between tables:\n\n`;
  markdown += `\`\`\`mermaid\n`;
  markdown += generateMermaidERD(entities, relationships, false);
  markdown += `\`\`\`\n\n`;

  // Generate migration history
  if (migrations.length > 0) {
    markdown += `## Migration History\n\n`;
    markdown += `| Timestamp | Description | Operations |\n`;
    markdown += `|-----------|-------------|------------|\n`;

    migrations.forEach(migration => {
      const operations = migration.operations.map(op => op.type).join(', ');
      markdown += `| ${migration.timestamp} | ${migration.description} | ${operations} |\n`;
    });

    markdown += `\n### Migration Details\n\n`;

    migrations.forEach(migration => {
      markdown += `#### ${migration.description} (${migration.timestamp})\n\n`;

      if (migration.operations.length > 0) {
        markdown += `**Operations:**\n\n`;
        migration.operations.forEach(op => {
          markdown += `- ${op.description}\n`;
        });
        markdown += `\n`;
      }
    });
  }

  return markdown;
}

/**
 * Generate Mermaid ERD
 */
function generateMermaidERD(entities, relationships, standalone = true) {
  let mermaid = '';

  if (standalone) {
    mermaid += `# Database Entity Relationship Diagram

This diagram shows the relationships between all tables in the KiraPilot database.

\`\`\`mermaid\n`;
  }

  mermaid += `erDiagram\n`;

  // Add entities
  Object.values(entities).forEach(entity => {
    mermaid += `    ${entity.name.toUpperCase()} {\n`;

    entity.fields.forEach(field => {
      const type = field.type.replace(/DateTimeUtc|String|i32|bool/, match => {
        switch (match) {
          case 'DateTimeUtc':
            return 'datetime';
          case 'String':
            return 'varchar';
          case 'i32':
            return 'int';
          case 'bool':
            return 'boolean';
          default:
            return match.toLowerCase();
        }
      });

      const key = field.primaryKey ? ' PK' : field.foreignKey ? ' FK' : '';
      const nullable = field.optional ? ' "nullable"' : '';

      mermaid += `        ${type} ${field.name}${key}${nullable}\n`;
    });

    mermaid += `    }\n`;
  });

  // Add relationships
  relationships.forEach(rel => {
    const fromTable = rel.from.toUpperCase();
    const toTable = rel.to.replace(/.*::/, '').toUpperCase();

    let relationshipSymbol;
    switch (rel.type) {
      case 'has_one':
        relationshipSymbol = '||--||';
        break;
      case 'has_many':
        relationshipSymbol = '||--o{';
        break;
      case 'belongs_to':
        relationshipSymbol = '}o--||';
        break;
      default:
        relationshipSymbol = '--';
    }

    mermaid += `    ${fromTable} ${relationshipSymbol} ${toTable} : "${rel.type}"\n`;
  });

  if (standalone) {
    mermaid += `\`\`\`\n`;
  }

  return mermaid;
}

module.exports = {
  generateSchemaDocs,
};

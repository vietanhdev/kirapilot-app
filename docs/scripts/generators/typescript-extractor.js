/**
 * TypeScript Interface Extraction Script
 *
 * Extracts TypeScript interfaces, types, and enums from the KiraPilot codebase
 * and generates comprehensive API documentation.
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

/**
 * Extract TypeScript interfaces and generate documentation
 */
async function generateTypeScriptDocs(config) {
  const typesFile = path.join(config.sourceDir, 'types/index.ts');

  if (!fs.existsSync(typesFile)) {
    throw new Error(`Types file not found: ${typesFile}`);
  }

  const sourceCode = fs.readFileSync(typesFile, 'utf8');
  const sourceFile = ts.createSourceFile(
    'index.ts',
    sourceCode,
    ts.ScriptTarget.Latest,
    true
  );

  const documentation = {
    interfaces: [],
    enums: [],
    types: [],
    constants: [],
  };

  // Visit all nodes in the AST
  function visit(node) {
    if (ts.isInterfaceDeclaration(node)) {
      documentation.interfaces.push(extractInterface(node, sourceCode));
    } else if (ts.isEnumDeclaration(node)) {
      documentation.enums.push(extractEnum(node, sourceCode));
    } else if (ts.isTypeAliasDeclaration(node)) {
      documentation.types.push(extractTypeAlias(node, sourceCode));
    } else if (ts.isVariableStatement(node)) {
      const constants = extractConstants(node, sourceCode);
      documentation.constants.push(...constants);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  // Generate markdown documentation
  const markdownContent = generateTypeScriptMarkdown(documentation);

  // Write to output file
  const outputFile = path.join(config.outputDir, 'typescript-interfaces.md');
  fs.writeFileSync(outputFile, markdownContent);

  console.log(`✅ Generated TypeScript documentation: ${outputFile}`);

  return documentation;
}

/**
 * Extract interface information
 */
function extractInterface(node, sourceCode) {
  const name = node.name.text;
  const members = [];
  const jsDocComment = getJSDocComment(node, sourceCode);

  node.members.forEach(member => {
    if (ts.isPropertySignature(member)) {
      const memberInfo = {
        name: member.name?.getText() || 'unknown',
        type: member.type?.getText() || 'unknown',
        optional: !!member.questionToken,
        comment: getJSDocComment(member, sourceCode),
      };
      members.push(memberInfo);
    }
  });

  return {
    name,
    members,
    comment: jsDocComment,
    category: categorizeInterface(name),
  };
}

/**
 * Extract enum information
 */
function extractEnum(node, sourceCode) {
  const name = node.name.text;
  const members = [];
  const jsDocComment = getJSDocComment(node, sourceCode);

  node.members.forEach(member => {
    const memberInfo = {
      name: member.name?.getText() || 'unknown',
      value: member.initializer?.getText() || 'auto',
      comment: getJSDocComment(member, sourceCode),
    };
    members.push(memberInfo);
  });

  return {
    name,
    members,
    comment: jsDocComment,
    category: 'enums',
  };
}

/**
 * Extract type alias information
 */
function extractTypeAlias(node, sourceCode) {
  const name = node.name.text;
  const type = node.type.getText();
  const jsDocComment = getJSDocComment(node, sourceCode);

  return {
    name,
    type,
    comment: jsDocComment,
    category: 'types',
  };
}

/**
 * Extract constants
 */
function extractConstants(node, sourceCode) {
  const constants = [];

  node.declarationList.declarations.forEach(declaration => {
    if (ts.isVariableDeclaration(declaration) && declaration.name) {
      const name = declaration.name.getText();
      const type = declaration.type?.getText() || 'inferred';
      const value = declaration.initializer?.getText() || 'undefined';
      const jsDocComment = getJSDocComment(node, sourceCode);

      // Only include exported constants
      const isExported = node.modifiers?.some(
        mod => mod.kind === ts.SyntaxKind.ExportKeyword
      );

      if (isExported) {
        constants.push({
          name,
          type,
          value,
          comment: jsDocComment,
          category: 'constants',
        });
      }
    }
  });

  return constants;
}

/**
 * Get JSDoc comment for a node
 */
function getJSDocComment(node, sourceCode) {
  const jsDoc = ts.getJSDocCommentsAndTags(node);
  if (jsDoc.length > 0) {
    const comment = jsDoc[0];
    if (comment.comment) {
      return comment.comment;
    }
  }

  // Fallback: look for comments above the node
  const start = node.getFullStart();
  const leadingTrivia = sourceCode.substring(start, node.getStart());
  const commentMatch = leadingTrivia.match(/\/\*\*([\s\S]*?)\*\//);

  if (commentMatch) {
    return commentMatch[1]
      .split('\n')
      .map(line => line.replace(/^\s*\*\s?/, ''))
      .join('\n')
      .trim();
  }

  return '';
}

/**
 * Categorize interfaces based on their names and usage
 */
function categorizeInterface(name) {
  if (name.includes('Request')) return 'requests';
  if (name.includes('Response')) return 'responses';
  if (name.includes('Config') || name.includes('Settings'))
    return 'configuration';
  if (name.includes('Stats') || name.includes('Metrics')) return 'analytics';
  if (name.includes('AI')) return 'ai';
  if (name.includes('Timer') || name.includes('Session'))
    return 'time-tracking';
  if (name.includes('Task')) return 'tasks';
  if (name.includes('Focus')) return 'focus';
  if (name.includes('Pattern')) return 'patterns';
  return 'core';
}

/**
 * Generate markdown documentation
 */
function generateTypeScriptMarkdown(documentation) {
  let markdown = `# TypeScript Interfaces

This document provides comprehensive documentation for all TypeScript interfaces, types, and enums used in KiraPilot.

*Generated on: ${new Date().toISOString()}*

## Table of Contents

- [Enums](#enums)
- [Core Interfaces](#core-interfaces)
- [Task Management](#task-management)
- [Time Tracking](#time-tracking)
- [AI & Analytics](#ai--analytics)
- [Configuration](#configuration)
- [Types & Constants](#types--constants)

`;

  // Generate enums section
  markdown += `## Enums\n\n`;
  documentation.enums.forEach(enumItem => {
    markdown += `### ${enumItem.name}\n\n`;
    if (enumItem.comment) {
      markdown += `${enumItem.comment}\n\n`;
    }

    markdown += `\`\`\`typescript\nenum ${enumItem.name} {\n`;
    enumItem.members.forEach(member => {
      markdown += `  ${member.name} = ${member.value},\n`;
    });
    markdown += `}\n\`\`\`\n\n`;

    // Add member descriptions if available
    const membersWithComments = enumItem.members.filter(m => m.comment);
    if (membersWithComments.length > 0) {
      markdown += `**Members:**\n\n`;
      membersWithComments.forEach(member => {
        markdown += `- \`${member.name}\`: ${member.comment}\n`;
      });
      markdown += `\n`;
    }
  });

  // Generate interfaces by category
  const categories = {
    core: 'Core Interfaces',
    tasks: 'Task Management',
    'time-tracking': 'Time Tracking',
    ai: 'AI & Analytics',
    configuration: 'Configuration',
  };

  Object.entries(categories).forEach(([category, title]) => {
    const interfaces = documentation.interfaces.filter(
      i => i.category === category
    );
    if (interfaces.length === 0) return;

    markdown += `## ${title}\n\n`;

    interfaces.forEach(interface => {
      markdown += `### ${interface.name}\n\n`;
      if (interface.comment) {
        markdown += `${interface.comment}\n\n`;
      }

      markdown += `\`\`\`typescript\ninterface ${interface.name} {\n`;
      interface.members.forEach(member => {
        const optional = member.optional ? '?' : '';
        markdown += `  ${member.name}${optional}: ${member.type};\n`;
      });
      markdown += `}\n\`\`\`\n\n`;

      // Add property descriptions
      const membersWithComments = interface.members.filter(m => m.comment);
      if (membersWithComments.length > 0) {
        markdown += `**Properties:**\n\n`;
        membersWithComments.forEach(member => {
          const optional = member.optional ? ' (optional)' : '';
          markdown += `- \`${member.name}\`${optional}: ${member.comment}\n`;
        });
        markdown += `\n`;
      }
    });
  });

  // Generate types and constants
  if (documentation.types.length > 0 || documentation.constants.length > 0) {
    markdown += `## Types & Constants\n\n`;

    if (documentation.types.length > 0) {
      markdown += `### Type Aliases\n\n`;
      documentation.types.forEach(type => {
        markdown += `#### ${type.name}\n\n`;
        if (type.comment) {
          markdown += `${type.comment}\n\n`;
        }
        markdown += `\`\`\`typescript\ntype ${type.name} = ${type.type};\n\`\`\`\n\n`;
      });
    }

    if (documentation.constants.length > 0) {
      markdown += `### Constants\n\n`;
      documentation.constants.forEach(constant => {
        markdown += `#### ${constant.name}\n\n`;
        if (constant.comment) {
          markdown += `${constant.comment}\n\n`;
        }
        markdown += `\`\`\`typescript\nconst ${constant.name}: ${constant.type} = ${constant.value};\n\`\`\`\n\n`;
      });
    }
  }

  return markdown;
}

module.exports = {
  generateTypeScriptDocs,
};

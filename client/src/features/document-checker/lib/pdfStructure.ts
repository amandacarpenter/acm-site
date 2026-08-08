import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRef } from 'pdf-lib';

export interface PdfTableStructure {
  tableCount: number;
  rowCount: number;
  headerCellCount: number;
  dataCellCount: number;
  emptyTableCount: number;
  nestedCellCount: number;
  invalidChildCount: number;
  missingHeaderAssociationCount: number;
  invalidScopeCount: number;
  rowScopeCount: number;
  columnScopeCount: number;
  bothScopeCount: number;
  headerCellsWithHeaders: number;
  dataCellsWithHeaders: number;
  parseError?: string;
}

const EMPTY_RESULT: PdfTableStructure = {
  tableCount: 0,
  rowCount: 0,
  headerCellCount: 0,
  dataCellCount: 0,
  emptyTableCount: 0,
  nestedCellCount: 0,
  invalidChildCount: 0,
  missingHeaderAssociationCount: 0,
  invalidScopeCount: 0,
  rowScopeCount: 0,
  columnScopeCount: 0,
  bothScopeCount: 0,
  headerCellsWithHeaders: 0,
  dataCellsWithHeaders: 0,
};

function nameValue(value: unknown): string {
  return value instanceof PDFName ? value.asString().replace(/^\//, '') : '';
}

/**
 * Read the low-level tagged-PDF structure tree. PDF.js exposes roles but strips
 * table-cell attributes such as Scope and Headers, so pdf-lib is used for this
 * focused structural check.
 */
export async function inspectPdfTables(bytes: Uint8Array): Promise<PdfTableStructure> {
  const result = { ...EMPTY_RESULT };
  try {
    const document = await PDFDocument.load(bytes, {
      updateMetadata: false,
      ignoreEncryption: true,
    });
    const context = document.context;
    const structRoot = document.catalog.lookup(PDFName.of('StructTreeRoot'));
    if (!(structRoot instanceof PDFDict)) return result;

    const roleMap = structRoot.lookup(PDFName.of('RoleMap'));
    const classMap = structRoot.lookup(PDFName.of('ClassMap'));
    const mappedRole = (dict: PDFDict): string => {
      const raw = nameValue(dict.get(PDFName.of('S')));
      if (!raw || !(roleMap instanceof PDFDict)) return raw;
      return nameValue(roleMap.get(PDFName.of(raw))) || raw;
    };

    const seenRefs = new Set<string>();

    const lookup = (value: unknown): unknown => {
      return value instanceof PDFRef ? context.lookup(value) : value;
    };

    const resolve = (value: unknown): unknown => {
      if (value instanceof PDFRef) {
        const key = value.toString();
        if (seenRefs.has(key)) return null;
        seenRefs.add(key);
        return context.lookup(value);
      }
      return value;
    };

    const attributeDicts = (value: unknown): PDFDict[] => {
      const resolved = lookup(value);
      if (resolved instanceof PDFDict) return [resolved];
      if (!(resolved instanceof PDFArray)) return [];

      const attributes: PDFDict[] = [];
      for (let index = 0; index < resolved.size(); index += 1) {
        const item = lookup(resolved.get(index));
        if (item instanceof PDFDict) attributes.push(item);
      }
      return attributes;
    };

    const cellAttributes = (dict: PDFDict): PDFDict[] => {
      const attributes = attributeDicts(dict.get(PDFName.of('A')));
      if (!(classMap instanceof PDFDict)) return attributes;

      const classes = lookup(dict.get(PDFName.of('C')));
      const addClass = (value: unknown) => {
        const className = nameValue(value);
        if (!className) return;
        attributes.push(...attributeDicts(classMap.get(PDFName.of(className))));
      };

      if (classes instanceof PDFArray) {
        for (let index = 0; index < classes.size(); index += 1) addClass(classes.get(index));
      } else {
        addClass(classes);
      }
      return attributes;
    };

    const readCellAssociation = (dict: PDFDict) => {
      let scope = nameValue(dict.get(PDFName.of('Scope')));
      let hasHeaders = dict.has(PDFName.of('Headers'));

      for (const attributes of cellAttributes(dict)) {
        scope ||= nameValue(attributes.get(PDFName.of('Scope')));
        hasHeaders ||= attributes.has(PDFName.of('Headers'));
      }
      return { scope, hasHeaders };
    };

    const walk = (value: unknown, parentRole = '', activeTable?: { rows: number; cells: number }) => {
      const resolved = resolve(value);
      if (resolved instanceof PDFArray) {
        for (let index = 0; index < resolved.size(); index += 1) {
          walk(resolved.get(index), parentRole, activeTable);
        }
        return;
      }
      if (!(resolved instanceof PDFDict)) return;

      const role = mappedRole(resolved);
      let currentTable = activeTable;

      if (role === 'Table') {
        result.tableCount += 1;
        currentTable = { rows: 0, cells: 0 };
      } else if (role === 'TR') {
        result.rowCount += 1;
        if (currentTable) currentTable.rows += 1;
      } else if (role === 'TH') {
        result.headerCellCount += 1;
        if (currentTable) currentTable.cells += 1;

        const { scope, hasHeaders } = readCellAssociation(resolved);
        if (hasHeaders) result.headerCellsWithHeaders += 1;
        if (scope === 'Row') result.rowScopeCount += 1;
        else if (scope === 'Column') result.columnScopeCount += 1;
        else if (scope === 'Both') result.bothScopeCount += 1;
        else if (scope) result.invalidScopeCount += 1;
        else if (!hasHeaders) result.missingHeaderAssociationCount += 1;
      } else if (role === 'TD') {
        result.dataCellCount += 1;
        if (currentTable) currentTable.cells += 1;
        if (readCellAssociation(resolved).hasHeaders) result.dataCellsWithHeaders += 1;
      }

      if ((parentRole === 'TD' || parentRole === 'TH') && (role === 'TD' || role === 'TH')) {
        result.nestedCellCount += 1;
      }
      if (parentRole === 'TR' && role && role !== 'TH' && role !== 'TD') {
        result.invalidChildCount += 1;
      }
      if (
        parentRole === 'Table' &&
        role &&
        !['TR', 'THead', 'TBody', 'TFoot', 'Caption'].includes(role)
      ) {
        result.invalidChildCount += 1;
      }

      const kids = resolved.get(PDFName.of('K'));
      if (kids) walk(kids, role || parentRole, currentTable);

      if (role === 'Table' && currentTable && (currentTable.rows === 0 || currentTable.cells === 0)) {
        result.emptyTableCount += 1;
      }
    };

    const rootKids = structRoot.get(PDFName.of('K'));
    if (rootKids) walk(rootKids);
    return result;
  } catch (error) {
    return {
      ...result,
      parseError: error instanceof Error ? error.message : 'The low-level tag tree could not be parsed.',
    };
  }
}

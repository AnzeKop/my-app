import Papa from "papaparse";
import * as XLSX from "xlsx";

export interface ParsedFile {
  name: string;
  headers: string[];
  data: Record<string, any>[];
  rowCount: number;
}

export interface ColumnMapping {
  column1: string;
  column2: string;
  confidence: number;
  reason: string;
  mergedName: string;
}

export interface MergeResult {
  headers: string[];
  data: Record<string, any>[];
  mappings: ColumnMapping[];
  rowCount: number;
  sourceFiles: string[];
}

export async function parseFile(file: File): Promise<ParsedFile> {
  const extension = file.name.split(".").pop()?.toLowerCase();

  return new Promise((resolve, reject) => {
    if (extension === "csv") {
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            reject(new Error(`CSV parsing error: ${results.errors[0].message}`));
            return;
          }

          const data = results.data as Record<string, any>[];
          const headers = Object.keys(data[0] || {});

          resolve({
            name: file.name,
            headers,
            data,
            rowCount: data.length,
          });
        },
        error: (error) => reject(error),
      });
    } else if (extension === "xlsx" || extension === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];

          const headers = Object.keys(jsonData[0] || {});

          resolve({
            name: file.name,
            headers,
            data: jsonData,
            rowCount: jsonData.length,
          });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error("File reading failed"));
      reader.readAsBinaryString(file);
    } else {
      reject(new Error(`Unsupported file type: ${extension}`));
    }
  });
}

export function getSampleData(data: Record<string, any>[], sampleSize: number = 5): Record<string, any>[] {
  return data.slice(0, Math.min(sampleSize, data.length));
}

export function mergeFiles(file1: ParsedFile, file2: ParsedFile, mappings: ColumnMapping[]): MergeResult {
  const mappingMap = new Map(mappings.map((m) => [m.column2, { column1: m.column1, mergedName: m.mergedName }]));
  const usedColumns1 = new Set(mappings.map((m) => m.column1));

  // Get all unique headers for the merged result
  const mergedHeaders = [
    ...file1.headers.filter((h) => !usedColumns1.has(h)), // Unmapped columns from file1
    ...mappings.map((m) => m.mergedName), // Mapped columns with new names
    ...file2.headers.filter((h) => !mappingMap.has(h)), // Unmapped columns from file2
  ];

  // Merge the data
  const mergedData: Record<string, any>[] = [];

  // Add all rows from file1
  file1.data.forEach((row) => {
    const mergedRow: Record<string, any> = {};

    // Add unmapped columns from file1
    file1.headers.forEach((header) => {
      if (!usedColumns1.has(header)) {
        mergedRow[header] = row[header];
      }
    });

    // Add mapped columns with merged names
    mappings.forEach((mapping) => {
      mergedRow[mapping.mergedName] = row[mapping.column1];
    });

    // Initialize unmapped columns from file2 as null
    file2.headers.forEach((header) => {
      if (!mappingMap.has(header)) {
        mergedRow[header] = null;
      }
    });

    mergedData.push(mergedRow);
  });

  // Add all rows from file2
  file2.data.forEach((row) => {
    const mergedRow: Record<string, any> = {};

    // Initialize unmapped columns from file1 as null
    file1.headers.forEach((header) => {
      if (!usedColumns1.has(header)) {
        mergedRow[header] = null;
      }
    });

    // Add mapped columns with merged names
    mappings.forEach((mapping) => {
      mergedRow[mapping.mergedName] = row[mapping.column2];
    });

    // Add unmapped columns from file2
    file2.headers.forEach((header) => {
      if (!mappingMap.has(header)) {
        mergedRow[header] = row[header];
      }
    });

    mergedData.push(mergedRow);
  });

  return {
    headers: mergedHeaders,
    data: mergedData,
    mappings,
    rowCount: mergedData.length,
    sourceFiles: [file1.name, file2.name],
  };
}

export function exportToCSV(result: MergeResult): string {
  const csv = Papa.unparse({
    fields: result.headers,
    data: result.data,
  });
  return csv;
}

export function downloadFile(content: string, filename: string, contentType: string = "text/csv") {
  const blob = new Blob([content], { type: contentType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

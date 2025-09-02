import { tool } from 'ai';
import { z } from 'zod';

export const analyzeColumnsSchema = z.object({
  columns1: z.array(z.string()).describe('Column headers from the first file'),
  columns2: z.array(z.string()).describe('Column headers from the second file'),
  sampleData1: z.array(z.record(z.string(), z.any())).optional().describe('Sample rows from first file for context'),
  sampleData2: z.array(z.record(z.string(), z.any())).optional().describe('Sample rows from second file for context'),
});

export const columnMappingSchema = z.object({
  mappings: z.array(z.object({
    column1: z.string().describe('Column name from first file'),
    column2: z.string().describe('Column name from second file'),
    confidence: z.number().min(0).max(1).describe('Confidence level of the mapping (0-1)'),
    reason: z.string().describe('Reason for the mapping'),
    mergedName: z.string().describe('Suggested name for the merged column')
  })).describe('Array of column mappings between the two files'),
  unmatchedColumns1: z.array(z.string()).describe('Columns from file 1 that have no match'),
  unmatchedColumns2: z.array(z.string()).describe('Columns from file 2 that have no match')
});

export const analyzeColumnsTool = tool({
  description: 'Analyze column headers from two files and suggest intelligent mappings for merging. This tool identifies similar columns that should be merged together (like "email" and "e-mail", "first_name" and "firstName", etc.)',
  parameters: analyzeColumnsSchema,
  execute: async ({ columns1, columns2, sampleData1, sampleData2 }) => {
    // This will be handled by the AI model - we return the input for processing
    return {
      columns1,
      columns2,
      sampleData1,
      sampleData2,
      message: 'Column analysis complete. Please provide mapping suggestions.'
    };
  }
});

export const validateMappingSchema = z.object({
  mappings: z.array(z.object({
    column1: z.string(),
    column2: z.string(),
    confidence: z.number(),
    reason: z.string(),
    mergedName: z.string()
  })),
  data1Sample: z.array(z.record(z.string(), z.any())).describe('Sample data from first file'),
  data2Sample: z.array(z.record(z.string(), z.any())).describe('Sample data from second file')
});

export const validateMappingTool = tool({
  description: 'Validate proposed column mappings by examining sample data to ensure the columns actually contain similar types of information',
  parameters: validateMappingSchema,
  execute: async ({ mappings, data1Sample, data2Sample }) => {
    return {
      mappings,
      data1Sample,
      data2Sample,
      message: 'Mapping validation complete. Please confirm if mappings are correct based on sample data.'
    };
  }
});

export const aiTools = {
  analyzeColumns: analyzeColumnsTool,
  validateMapping: validateMappingTool,
};
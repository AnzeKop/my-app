import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

const columnMappingSchema = z.object({
  mappings: z
    .array(
      z.object({
        column1: z.string().describe("Column name from first file"),
        column2: z.string().describe("Column name from second file"),
        confidence: z.number().min(0).max(1).describe("Confidence level of the mapping (0-1)"),
        reason: z.string().describe("Reason for the mapping"),
        mergedName: z.string().describe("Suggested name for the merged column"),
      })
    )
    .describe("Array of column mappings between the two files"),
  unmatchedColumns1: z.array(z.string()).describe("Columns from file 1 that have no match"),
  unmatchedColumns2: z.array(z.string()).describe("Columns from file 2 that have no match"),
});

export async function POST(request: NextRequest) {
  try {
    console.log(process.env.OPENAI_API_KEY, "OPENAI_API_KEY");
    const body = await request.json();
    const { file1, file2 } = body;

    if (!file1 || !file2) {
      return NextResponse.json({ error: "Both files are required" }, { status: 400 });
    }

    const prompt = `
You are an expert data analyst tasked with analyzing two datasets and finding intelligent column mappings for merging them.

File 1 (${file1.name}):
Headers: ${file1.headers.join(", ")}
Sample data (first 3 rows):
${JSON.stringify(file1.sampleData, null, 2)}

File 2 (${file2.name}):
Headers: ${file2.headers.join(", ")}
Sample data (first 3 rows):
${JSON.stringify(file2.sampleData, null, 2)}

Your task is to identify columns that should be merged together. Look for:
1. Exact matches (case-insensitive)
2. Similar names with different formats (e.g., "email" vs "e-mail", "firstName" vs "first_name")
3. Synonymous column names (e.g., "phone" vs "telephone", "id" vs "identifier")
4. Columns that represent the same type of data based on sample values

For each mapping, provide:
- The column names from both files
- A confidence score (0-1) based on how certain you are about the match
- A clear reason for the mapping
- A suggested merged column name (use the cleaner/more standard format)

Only suggest mappings where you're reasonably confident (>0.6) that the columns contain the same type of information.

Also identify columns that don't have matches in the other file.
`;

    const result = await generateObject({
      model: openai("gpt-4o-mini"),
      prompt,
      schema: columnMappingSchema,
    });

    return NextResponse.json(result.object);
  } catch (error) {
    console.error("Error analyzing columns:", error);
    return NextResponse.json({ error: "Failed to analyze columns" }, { status: 500 });
  }
}

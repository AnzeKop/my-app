import { NextRequest, NextResponse } from 'next/server';
import { mergeFiles, type ParsedFile, type ColumnMapping } from '@/lib/file-processor';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { file1, file2, mappings } = body;

    if (!file1 || !file2) {
      return NextResponse.json({ error: 'Both files are required' }, { status: 400 });
    }

    if (!Array.isArray(mappings)) {
      return NextResponse.json({ error: 'Mappings must be an array' }, { status: 400 });
    }

    // Convert the request data back to ParsedFile format
    const parsedFile1: ParsedFile = {
      name: file1.name,
      headers: file1.headers,
      data: file1.data,
      rowCount: file1.rowCount
    };

    const parsedFile2: ParsedFile = {
      name: file2.name,
      headers: file2.headers,
      data: file2.data,
      rowCount: file2.rowCount
    };

    // Perform the merge
    const result = mergeFiles(parsedFile1, parsedFile2, mappings as ColumnMapping[]);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error merging files:', error);
    return NextResponse.json(
      { error: 'Failed to merge files' },
      { status: 500 }
    );
  }
}
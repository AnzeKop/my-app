'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileSpreadsheet, Loader2, Download, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

import { parseFile, type ParsedFile, type ColumnMapping, type MergeResult, exportToCSV, downloadFile } from '@/lib/file-processor';

interface FileWithPreview extends ParsedFile {
  file: File;
}

export default function FileMerger() {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const csvXlsxFiles = acceptedFiles.filter(file => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      return ext === 'csv' || ext === 'xlsx' || ext === 'xls';
    });

    if (csvXlsxFiles.length === 0) {
      toast.error('Please upload only CSV or Excel files');
      return;
    }

    if (files.length + csvXlsxFiles.length > 2) {
      toast.error('You can upload maximum 2 files');
      return;
    }

    setIsProcessing(true);

    try {
      const parsedFiles: FileWithPreview[] = [];
      
      for (const file of csvXlsxFiles) {
        try {
          const parsed = await parseFile(file);
          parsedFiles.push({ ...parsed, file });
        } catch (error) {
          toast.error(`Error parsing ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      setFiles(prev => [...prev, ...parsedFiles]);
      
      if (parsedFiles.length > 0) {
        toast.success(`Successfully parsed ${parsedFiles.length} file(s)`);
      }
    } catch (error) {
      toast.error('Error processing files');
    } finally {
      setIsProcessing(false);
    }
  }, [files.length]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    maxFiles: 2
  });

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setMappings([]);
    setMergeResult(null);
  };

  const analyzeMappings = async () => {
    if (files.length !== 2) {
      toast.error('Please upload exactly 2 files to analyze mappings');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/api/analyze-columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file1: {
            name: files[0].name,
            headers: files[0].headers,
            sampleData: files[0].data.slice(0, 3)
          },
          file2: {
            name: files[1].name,
            headers: files[1].headers,
            sampleData: files[1].data.slice(0, 3)
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to analyze columns');
      }

      const result = await response.json();
      setMappings(result.mappings || []);
      toast.success('Column analysis complete!');
    } catch (error) {
      toast.error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const performMerge = async () => {
    if (files.length !== 2) {
      toast.error('Please upload exactly 2 files to merge');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/api/merge-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file1: files[0],
          file2: files[1],
          mappings
        })
      });

      if (!response.ok) {
        throw new Error('Failed to merge files');
      }

      const result = await response.json();
      setMergeResult(result);
      toast.success('Files merged successfully!');
    } catch (error) {
      toast.error(`Merge failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadMergedFile = () => {
    if (!mergeResult) return;
    
    const csv = exportToCSV(mergeResult);
    const filename = `merged_${Date.now()}.csv`;
    downloadFile(csv, filename);
    toast.success('File downloaded successfully!');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">AI-Powered File Merger</h1>
        <p className="text-muted-foreground">
          Upload CSV or Excel files and let AI intelligently merge them with column deduplication
        </p>
      </div>

      {/* File Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Files</CardTitle>
          <CardDescription>
            Drag and drop up to 2 CSV or Excel files, or click to browse
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            {isDragActive ? (
              <p>Drop the files here...</p>
            ) : (
              <div>
                <p className="text-lg font-medium">Drop files here or click to upload</p>
                <p className="text-sm text-muted-foreground">Supports CSV, XLS, XLSX files</p>
              </div>
            )}
          </div>

          {isProcessing && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processing files...</span>
              </div>
              <Progress value={75} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Uploaded Files */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Uploaded Files</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {files.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {file.rowCount} rows, {file.headers.length} columns
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => removeFile(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <div className="flex gap-2">
              <Button
                onClick={analyzeMappings}
                disabled={files.length !== 2 || isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Analyze Column Mappings
              </Button>
              
              {mappings.length > 0 && (
                <Button
                  onClick={performMerge}
                  disabled={isProcessing}
                  variant="default"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Merge Files
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Column Mappings */}
      {mappings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>AI-Detected Column Mappings</CardTitle>
            <CardDescription>
              The AI has analyzed your files and found these potential column matches
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File 1 Column</TableHead>
                  <TableHead>File 2 Column</TableHead>
                  <TableHead>Merged Name</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((mapping, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{mapping.column1}</TableCell>
                    <TableCell className="font-medium">{mapping.column2}</TableCell>
                    <TableCell>{mapping.mergedName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={mapping.confidence * 100} className="w-16" />
                        <span className="text-sm">{Math.round(mapping.confidence * 100)}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {mapping.reason}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Merge Results */}
      {mergeResult && (
        <Card>
          <CardHeader>
            <CardTitle>Merge Results</CardTitle>
            <CardDescription>
              Successfully merged {mergeResult.sourceFiles.join(' and ')} into {mergeResult.rowCount} rows with {mergeResult.headers.length} columns
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={downloadMergedFile} className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Download Merged CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-2"
              >
                <Eye className="h-4 w-4" />
                {showPreview ? 'Hide' : 'Show'} Preview
              </Button>
            </div>

            {showPreview && (
              <div className="border rounded-lg overflow-auto max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {mergeResult.headers.map((header) => (
                        <TableHead key={header}>{header}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mergeResult.data.slice(0, 10).map((row, index) => (
                      <TableRow key={index}>
                        {mergeResult.headers.map((header) => (
                          <TableCell key={header}>
                            {row[header] || '—'}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {mergeResult.data.length > 10 && (
                  <div className="p-2 text-center text-sm text-muted-foreground border-t">
                    Showing first 10 of {mergeResult.data.length} rows
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
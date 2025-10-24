import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileJson, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function NakamotoImport() {
  const [file, setFile] = useState<File | null>(null);
  const [jsonData, setJsonData] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [tenantId, setTenantId] = useState('');
  const [result, setResult] = useState<{ success: boolean; message: string; stats?: any; details?: any } | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/json') {
        toast({
          title: 'Invalid file type',
          description: 'Please select a JSON file',
          variant: 'destructive',
        });
        return;
      }
      setFile(selectedFile);
      setResult(null);
      
      // Read and populate textarea
      try {
        const text = await selectedFile.text();
        setJsonData(text);
        toast({
          title: 'File loaded',
          description: 'JSON data loaded into editor',
        });
      } catch (error) {
        toast({
          title: 'Failed to read file',
          description: 'Could not read the JSON file',
          variant: 'destructive',
        });
      }
    }
  };

  const handleUpload = async () => {
    if (!jsonData.trim()) {
      toast({
        title: 'No data',
        description: 'Please provide JSON data',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    setResult(null);

    try {
      const parsedData = JSON.parse(jsonData);

      const { data, error } = await supabase.functions.invoke('nakamoto_import', {
        body: { 
          tenant_id: tenantId.trim() || undefined,
          data: parsedData.data || parsedData
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setResult({
        success: true,
        message: data.message || 'Import completed successfully',
        stats: data.stats,
        details: data,
      });

      toast({
        title: 'Import successful',
        description: `Imported ${data.stats?.users || 0} users, ${data.stats?.interactions || 0} interactions`,
      });
    } catch (error: any) {
      const isFetchErr = error?.name === 'FunctionsFetchError';
      const errorMessage = isFetchErr
        ? 'Unable to reach import function. Check authentication and try again.'
        : (error?.message || 'Failed to import data');
      setResult({
        success: false,
        message: errorMessage,
        details: error,
      });

      toast({
        title: 'Import failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClear = () => {
    setJsonData('');
    setFile(null);
    setResult(null);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            ← Back to Dashboard
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Nakamoto Data Import</CardTitle>
            <CardDescription>
              Import users, interactions, knowledge base, and prompts from Nakamoto
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tenant-id">Tenant ID (optional)</Label>
                <Input
                  id="tenant-id"
                  placeholder="Leave empty to auto-detect from your account"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  disabled={isUploading}
                />
                <p className="text-xs text-muted-foreground">
                  If not provided, the system will auto-detect your tenant
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="file-upload">Upload JSON File</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                    disabled={isUploading}
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    {file ? (
                      <>
                        <FileJson className="h-10 w-10 text-primary" />
                        <p className="text-sm font-medium">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024).toFixed(2)} KB
                        </p>
                      </>
                    ) : (
                      <>
                        <Upload className="h-10 w-10 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Click to select a JSON file
                        </p>
                      </>
                    )}
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="json-data">Or Paste JSON Data</Label>
                <Textarea
                  id="json-data"
                  placeholder='{"data": {"users": [...], "interactions": [...], "knowledge_base": [...], "prompts": [...]}}'
                  value={jsonData}
                  onChange={(e) => setJsonData(e.target.value)}
                  disabled={isUploading}
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleUpload}
                  disabled={!jsonData.trim() || isUploading}
                  className="flex-1"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Import Data
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleClear}
                  disabled={isUploading}
                >
                  Clear
                </Button>
              </div>
            </div>

            {result && (
              <Alert variant={result.success ? 'default' : 'destructive'}>
                {result.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  <strong>{result.message}</strong>
                  {result.success && result.stats && (
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div className="p-2 bg-muted rounded text-center">
                        <p className="text-xs text-muted-foreground">Users</p>
                        <p className="text-lg font-bold">{result.stats.users}</p>
                      </div>
                      <div className="p-2 bg-muted rounded text-center">
                        <p className="text-xs text-muted-foreground">Interactions</p>
                        <p className="text-lg font-bold">{result.stats.interactions}</p>
                      </div>
                      <div className="p-2 bg-muted rounded text-center">
                        <p className="text-xs text-muted-foreground">KB Docs</p>
                        <p className="text-lg font-bold">{result.stats.knowledge_base}</p>
                      </div>
                      <div className="p-2 bg-muted rounded text-center">
                        <p className="text-xs text-muted-foreground">Prompts</p>
                        <p className="text-lg font-bold">{result.stats.prompts}</p>
                      </div>
                    </div>
                  )}
                  {!result.success && result.details && (
                    <pre className="mt-2 text-xs overflow-x-auto max-h-40">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expected Data Format</CardTitle>
            <CardDescription>
              JSON structure for Nakamoto migration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`{
  "tenant_id": "optional-uuid",
  "data": {
    "users": [...],
    "interactions": [...],
    "knowledge_base": [...],
    "prompts": [...]
  }
}`}
                </pre>
                <p className="text-xs text-muted-foreground mt-2">
                  See <code>NAKAMOTO_IMPORT_FORMAT.md</code> for complete schema documentation
                </p>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

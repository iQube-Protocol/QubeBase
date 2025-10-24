import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileJson, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function NakamotoImport() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [tenantId, setTenantId] = useState('');
  const [result, setResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setResult(null);

    try {
      const fileContent = await file.text();
      const jsonData = JSON.parse(fileContent);

      const { data, error } = await supabase.functions.invoke('nakamoto_import', {
        body: { data: jsonData, tenant_id: tenantId.trim() || undefined },
      });

      if (error) throw error;

      setResult({
        success: true,
        message: 'Import completed successfully',
        details: data,
      });

      toast({
        title: 'Import successful',
        description: `Successfully imported registry mirror data`,
      });
    } catch (error: any) {
      const isFetchErr = error?.name === 'FunctionsFetchError';
      const errorMessage = isFetchErr
        ? 'Unable to reach import function. Try again, and consider specifying a Tenant ID if the problem persists.'
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
            <CardTitle>Nakamoto Database Import</CardTitle>
            <CardDescription>
              Upload a JSON file to import registry mirror data (templates, instances, proofs, entitlements)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Expected JSON structure:</strong>
                  <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">
{`{
  "templates": [
    {
      "name": "ContentQube.Template.v1",
      "meta_public": {"schema": "content"}
    }
  ],
  "instances": [
    {
      "template_name": "ContentQube.Template.v1",
      "meta_public": {"title": "Hello World"},
      "blak_pointer": "cid://...",
      "tokenqube_key_id": "keyref-demo"
    }
  ],
  "proofs": [
    {
      "instance_ref": 0,
      "txid": "0x123...",
      "chain": "bitcoin",
      "block_height": 800000,
      "proof_type": "merkle",
      "signature": "sig123"
    }
  ],
  "entitlements": [
    {
      "instance_ref": 0,
      "expires_at": "2025-12-31T23:59:59Z",
      "meta": {"access_level": "read"}
    }
  ]
}`}
                  </pre>
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="tenant-id">Tenant ID (optional)</Label>
                <Input
                  id="tenant-id"
                  placeholder="e.g., 3f8a... (leave empty to auto-detect)"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                />
              </div>

              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  {file ? (
                    <>
                      <FileJson className="h-12 w-12 text-primary" />
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(2)} KB
                      </p>
                    </>
                  ) : (
                    <>
                      <Upload className="h-12 w-12 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Click to select a JSON file
                      </p>
                    </>
                  )}
                </label>
              </div>

              <Button
                onClick={handleUpload}
                disabled={!file || isUploading}
                className="w-full"
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
                  {result.details && (
                    <pre className="mt-2 text-xs overflow-x-auto">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

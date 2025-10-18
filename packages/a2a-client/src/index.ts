export type A2AClientOpts = { baseUrl: string; getAuthToken: () => Promise<string> };

export class A2AClient {
  constructor(private opts: A2AClientOpts) {}

  async runTask(payload: { tenantId: string; task: string; params: Record<string, any> }) {
    const token = await this.opts.getAuthToken();
    const res = await fetch(`${this.opts.baseUrl}/a2a/run_task`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const j = await res.json();
    if (!res.ok || j.error) throw new Error(j.error || "A2A run_task failed");
    return j;
  }

  async invokeTool(payload: { tenantId: string; tool: string; args: any }) {
    const token = await this.opts.getAuthToken();
    const res = await fetch(`${this.opts.baseUrl}/a2a/invoke_tool`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const j = await res.json();
    if (!res.ok || j.error) throw new Error(j.error || "A2A invoke_tool failed");
    return j;
  }
}

export function ping(): string {
  return 'a2a:pong';
}

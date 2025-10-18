import { AgentiqCore, Envelope } from "@qriptoagentiq/core-client";

export class Kn0w1Client {
  constructor(private core: AgentiqCore, private ctx: { tenantId: string; siteId: string }) {}

  feed(limit = 20) { return this.core.kn0w1Feed(limit); }

  async uploadSensitivePost(args: { instanceId: string; file: File; envelope: Envelope }) {
    const { payloadId, storageUri } = await this.core.uploadIntake({
      ctx: this.ctx,
      instanceId: args.instanceId,
      file: args.file,
      sensitive: true,
      envelope: args.envelope
    });
    await this.core.uploadToStorage(storageUri, args.file);
    return payloadId;
  }

  getSignedUrl(payloadId: string, isoCountry?: string) {
    return this.core.signedUrl({ payloadId, isoCountry });
  }

  shareToTenant(payloadId: string, tenantId: string, envelope: Envelope) {
    return this.core.sharePayload({ payloadId, subjectType: "tenant", subjectId: tenantId, envelope });
  }
}

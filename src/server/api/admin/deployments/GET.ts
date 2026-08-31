import type { Request, Response } from 'express';
import { getSecret } from '#runtime/secrets';

const RENDER_API_TIMEOUT_MS = 5_000;

interface RenderDeploy {
  id?: string;
  status?: string;
  commit?: { id?: string; message?: string };
  createdAt?: string;
  updatedAt?: string;
  finishedAt?: string;
}

export default async function handler(_req: Request, res: Response) {
  const serviceId = String(getSecret('RENDER_SERVICE_ID') || process.env.RENDER_SERVICE_ID || '').trim();
  const apiKey = String(getSecret('RENDER_API_KEY') || process.env.RENDER_API_KEY || '').trim();
  const current = {
    commit: process.env.RENDER_GIT_COMMIT ?? null,
    branch: process.env.RENDER_GIT_BRANCH ?? null,
    serviceName: process.env.RENDER_SERVICE_NAME ?? null,
    instanceConfigured: Boolean(process.env.RENDER_INSTANCE_ID),
  };

  if (!serviceId || !apiKey) {
    return res.json({
      current,
      provider: { configured: false, state: 'not_configured', lastCheckedAt: new Date().toISOString() },
      deployments: [],
      controls: { triggerAvailable: false, rollbackAvailable: false, arbitraryApiCalls: false },
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RENDER_API_TIMEOUT_MS);
  try {
    const response = await fetch(`https://api.render.com/v1/services/${encodeURIComponent(serviceId)}/deploys?limit=20`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      return res.json({
        current,
        provider: { configured: true, state: 'error', lastCheckedAt: new Date().toISOString(), statusCode: response.status },
        deployments: [],
        controls: { triggerAvailable: false, rollbackAvailable: false, arbitraryApiCalls: false },
      });
    }
    const payload = await response.json() as Array<{ deploy?: RenderDeploy } | RenderDeploy>;
    const providerDeployments: RenderDeploy[] = payload
      .map((item): RenderDeploy | undefined => 'deploy' in item ? item.deploy : item as RenderDeploy)
      .filter((deploy): deploy is RenderDeploy => Boolean(deploy));
    const deployments = providerDeployments.map((deploy) => ({
      id: deploy.id ?? null,
      status: deploy.status ?? 'unknown',
      commit: deploy.commit?.id ?? null,
      message: deploy.commit?.message ?? null,
      createdAt: deploy.createdAt ?? null,
      updatedAt: deploy.updatedAt ?? null,
      finishedAt: deploy.finishedAt ?? null,
    }));
    return res.json({
      current,
      provider: { configured: true, state: 'healthy', lastCheckedAt: new Date().toISOString() },
      deployments,
      controls: { triggerAvailable: false, rollbackAvailable: false, arbitraryApiCalls: false },
    });
  } catch {
    return res.json({
      current,
      provider: { configured: true, state: 'error', lastCheckedAt: new Date().toISOString() },
      deployments: [],
      controls: { triggerAvailable: false, rollbackAvailable: false, arbitraryApiCalls: false },
    });
  } finally {
    clearTimeout(timeout);
  }
}

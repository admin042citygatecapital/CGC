import { Helmet } from '@dr.pogodin/react-helmet';
import { useState } from 'react';
import {
  FileText, FileCode, Download, ExternalLink,
  BookOpen, Table, Braces, Code2, CheckCircle,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { authHeaders } from '@/lib/adminAuth';

interface DocFile {
  id: string;
  title: string;
  description: string;
  format: string;
  filename: string;
  path: string;
  icon: React.ElementType;
  badge: string;
  badgeVariant: 'default' | 'secondary' | 'outline';
  size: string;
  useCases: string[];
}

const docs: DocFile[] = [
  {
    id: 'markdown',
    title: 'Markdown Documentation',
    description: 'Human-readable reference snapshot covering the routes documented on 2026-06-04. Verify current behavior in the Developer Center and source route registry before implementation.',
    format: 'Markdown (.md)',
    filename: 'api-documentation.md',
    path: '/api/admin/documentation/markdown',
    icon: BookOpen,
    badge: 'Recommended',
    badgeVariant: 'default',
    size: '~28 KB',
    useCases: ['GitHub / GitLab wiki', 'Notion / Confluence', 'Internal developer docs', 'Onboarding reference'],
  },
  {
    id: 'csv',
    title: 'CSV Spreadsheet',
    description: 'Reference-snapshot routes in a flat table. It is useful for review and reconciliation but is not the authoritative current route inventory.',
    format: 'CSV (.csv)',
    filename: 'api-documentation.csv',
    path: '/api/admin/documentation/csv',
    icon: Table,
    badge: 'Spreadsheet',
    badgeVariant: 'secondary',
    size: '~14 KB',
    useCases: ['Excel / Google Sheets', 'Data analysis', 'Compliance reporting', 'Quick route lookup'],
  },
  {
    id: 'postman',
    title: 'Postman Collection',
    description: 'Reference Postman collection for controlled testing. Review each request against current authorization and preview-lock behavior before use.',
    format: 'JSON (.json)',
    filename: 'postman-collection.json',
    path: '/api/admin/documentation/postman',
    icon: Braces,
    badge: 'Testing',
    badgeVariant: 'secondary',
    size: '~42 KB',
    useCases: ['API testing', 'Penetration testing', 'QA automation', 'Integration development'],
  },
  {
    id: 'openapi',
    title: 'OpenAPI / Swagger YAML',
    description: 'OpenAPI 3.1 reference snapshot. It may not include routes added after 2026-06-04 and must not be treated as the current production contract without verification.',
    format: 'YAML (.yaml)',
    filename: 'openapi.yaml',
    path: '/api/admin/documentation/openapi',
    icon: Code2,
    badge: 'OpenAPI 3.1',
    badgeVariant: 'outline',
    size: '~38 KB',
    useCases: ['Swagger UI / Redoc', 'Code generation', 'API gateway config', 'SDK generation'],
  },
];

const stats = [
  { label: 'Protected Formats', value: '4' },
  { label: 'Snapshot Date', value: '2026-06-04' },
  { label: 'Current Inventory', value: 'Developer Center' },
  { label: 'Financial Writes', value: 'Preview Locked' },
];

export default function AdminDocumentation() {
  const [downloaded, setDownloaded] = useState<Record<string, boolean>>({});
  const [downloadError, setDownloadError] = useState('');

  async function fetchDocument(doc: DocFile): Promise<Blob> {
    const response = await fetch(doc.path, { headers: authHeaders(), credentials: 'same-origin' });
    if (!response.ok) throw new Error(`Download failed (${response.status})`);
    return response.blob();
  }

  async function handleDownload(doc: DocFile) {
    setDownloadError('');
    try {
      const blob = await fetchDocument(doc);
      const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.filename;
    a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setDownloaded(prev => ({ ...prev, [doc.id]: true }));
    setTimeout(() => setDownloaded(prev => ({ ...prev, [doc.id]: false })), 3000);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Download failed');
    }
  }

  async function handleOpenInBrowser(doc: DocFile) {
    setDownloadError('');
    const preview = window.open('', '_blank');
    if (!preview) {
      setDownloadError('Document preview was blocked by the browser');
      return;
    }
    preview.opener = null;
    try {
      const blob = await fetchDocument(doc);
      const url = URL.createObjectURL(blob);
      preview.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      preview.close();
      setDownloadError(error instanceof Error ? error.message : 'Document preview failed');
    }
  }

  return (
    <>
      <Helmet>
        <title>API Documentation — CGC Admin</title>
        <meta name="description" content="API and technical documentation for City Gate Capital administrators." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://citygate.capital/admin/documentation" />
      </Helmet>
      <AdminLayout title="Documentation">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-white text-2xl font-bold tracking-tight">API Reference Snapshot</h1>
            <p className="text-white/40 text-sm mt-1">
              Administrator-only historical reference. The current runtime and source route registry remain authoritative.
            </p>
          </div>
          <Badge variant="outline" className="border-[#C9A84C]/30 text-[#C9A84C] text-xs px-3 py-1">
            Reference snapshot · 2026-06-04
          </Badge>
        </div>

        {downloadError && (
          <div role="alert" className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {downloadError}
          </div>
        )}

        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {stats.map(s => (
            <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-[#C9A84C]">{s.value}</div>
              <div className="text-white/40 text-xs mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Download cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          {docs.map(doc => {
            const Icon = doc.icon;
            const isDone = downloaded[doc.id];
            return (
              <Card key={doc.id} className="bg-white/[0.03] border-white/[0.06] hover:border-[#C9A84C]/20 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#C9A84C]/10 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-[#C9A84C]" />
                      </div>
                      <div>
                        <CardTitle className="text-white text-base font-semibold">{doc.title}</CardTitle>
                        <div className="text-white/30 text-xs mt-0.5">{doc.format} · {doc.size}</div>
                      </div>
                    </div>
                    <Badge
                      variant={doc.badgeVariant}
                      className={
                        doc.badgeVariant === 'default'
                          ? 'bg-[#C9A84C]/15 text-[#C9A84C] border-[#C9A84C]/20 text-xs shrink-0'
                          : doc.badgeVariant === 'outline'
                          ? 'border-white/20 text-white/50 text-xs shrink-0'
                          : 'bg-white/[0.06] text-white/50 border-white/10 text-xs shrink-0'
                      }
                    >
                      {doc.badge}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="text-white/40 text-sm leading-relaxed mb-4">
                    {doc.description}
                  </CardDescription>

                  {/* Use cases */}
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {doc.useCases.map(uc => (
                      <span key={uc} className="text-xs px-2 py-0.5 rounded-full bg-white/[0.04] text-white/30 border border-white/[0.06]">
                        {uc}
                      </span>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleDownload(doc)}
                      className={`flex-1 gap-2 text-sm font-medium transition-all ${
                        isDone
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                          : 'bg-[#C9A84C]/15 text-[#C9A84C] border border-[#C9A84C]/20 hover:bg-[#C9A84C]/25'
                      }`}
                      variant="ghost"
                    >
                      {isDone ? (
                        <><CheckCircle className="w-4 h-4" /> Downloaded</>
                      ) : (
                        <><Download className="w-4 h-4" /> Download</>
                      )}
                    </Button>
                    <Button
                      onClick={() => handleOpenInBrowser(doc)}
                      variant="ghost"
                      className="gap-2 text-sm text-white/40 border border-white/[0.06] hover:text-white/70 hover:border-white/20"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Quick reference table */}
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#C9A84C]" />
              <CardTitle className="text-white text-base">Quick Route Summary</CardTitle>
            </div>
            <CardDescription className="text-white/40 text-sm">
              Selected snapshot endpoints. Confirm current behavior in the Developer Center before relying on them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left text-white/30 font-medium pb-3 pr-4">Route</th>
                    <th className="text-left text-white/30 font-medium pb-3 pr-4">Method</th>
                    <th className="text-left text-white/30 font-medium pb-3 pr-4">Description</th>
                    <th className="text-left text-white/30 font-medium pb-3">Auth</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {[
                    ['/api/health', 'GET', 'Server health check', 'Public'],
                    ['/api/csrf', 'GET', 'Get CSRF token', 'Public'],
                    ['/api/cms/content', 'GET', 'Public CMS content', 'Public'],
                    ['/api/contact', 'POST', 'Submit contact form', 'Public'],
                    ['/api/users/login', 'POST', 'Customer login', 'Public'],
                    ['/api/users/balance', 'GET', 'Demonstration balance projection', 'Customer'],
                    ['/api/users/transactions', 'GET', 'Demonstration transaction history', 'Customer'],
                    ['/api/users/cards', 'GET', 'Demonstration card records', 'Customer'],
                    ['/api/users/transfer', 'POST', 'Preview-locked transfer route', 'Customer'],
                    ['/api/admin/auth/login', 'POST', 'Admin login', 'Public'],
                    ['/api/admin/stats', 'GET', 'Dashboard KPIs', 'Admin'],
                    ['/api/admin/users', 'GET', 'List / search users', 'Admin'],
                    ['/api/admin/transactions/real', 'GET', 'Persistent preview transaction records', 'Admin'],
                    ['/api/admin/balance/adjust', 'POST', 'Preview-locked balance adjustment', 'Admin'],
                    ['/api/admin/kyc/queue', 'GET', 'Demonstration KYC review queue', 'Admin'],
                    ['/api/admin/security/logs', 'GET', 'Security logs', 'Admin'],
                    ['/api/admin/cms', 'GET/POST', 'CMS content', 'Admin'],
                    ['/api/admin/smtp/status', 'GET', 'Email transport status', 'Admin'],
                    ['/api/admin/rates', 'GET', 'Rates & fee config', 'Admin'],
                    ['/api/admin/support', 'GET', 'Support tickets', 'Admin'],
                  ].map(([route, method, desc, auth]) => (
                    <tr key={route + method} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-2.5 pr-4 font-mono text-xs text-[#C9A84C]/80">{route}</td>
                      <td className="py-2.5 pr-4">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                          method === 'GET' ? 'text-emerald-400 bg-emerald-500/10' :
                          method === 'POST' ? 'text-blue-400 bg-blue-500/10' :
                          method === 'PATCH' ? 'text-amber-400 bg-amber-500/10' :
                          method === 'DELETE' ? 'text-red-400 bg-red-500/10' :
                          'text-white/50 bg-white/[0.06]'
                        }`}>{method}</span>
                      </td>
                      <td className="py-2.5 pr-4 text-white/50">{desc}</td>
                      <td className="py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          auth === 'Public' ? 'text-white/40 bg-white/[0.04]' :
                          auth === 'Customer' ? 'text-blue-400/70 bg-blue-500/10' :
                          'text-[#C9A84C]/70 bg-[#C9A84C]/10'
                        }`}>{auth}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Postman import tip */}
        <div className="mt-4 p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 flex gap-3">
          <FileCode className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-white/70 text-sm font-medium">Postman Import Tip</p>
            <p className="text-white/40 text-xs mt-1 leading-relaxed">
              Download the Postman collection, then in Postman: <strong className="text-white/50">File → Import → Upload Files</strong>.
              Set the <code className="text-[#C9A84C]/70 bg-[#C9A84C]/5 px-1 rounded">adminToken</code> collection variable after logging in via{' '}
              <code className="text-[#C9A84C]/70 bg-[#C9A84C]/5 px-1 rounded">POST /api/admin/auth/login</code> — the login request auto-saves it.
            </p>
          </div>
        </div>

      </AdminLayout>
    </>
  );
}

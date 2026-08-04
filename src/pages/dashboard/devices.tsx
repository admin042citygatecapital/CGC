/**
 * /dashboard/devices — Trusted Device Management
 * Shows all trusted devices, allows revocation, displays last-seen info.
 */
import { Helmet } from '@dr.pogodin/react-helmet';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Smartphone, Monitor, Tablet, Globe,
  Trash2, Loader2, ShieldCheck, Clock, MapPin,
  CheckCircle2, AlertTriangle, Laptop,
} from 'lucide-react';
import { useCustomerAuth } from '@/lib/customerAuth';

interface TrustedDevice {
  id:          string;
  name:        string;
  type:        'mobile' | 'desktop' | 'tablet' | 'unknown';
  browser:     string;
  os:          string;
  ip:          string;
  location:    string;
  lastSeen:    string;
  addedAt:     string;
  current:     boolean;
  trusted:     boolean;
}

function deviceIcon(type: string) {
  switch (type) {
    case 'mobile':  return Smartphone;
    case 'tablet':  return Tablet;
    case 'desktop': return Laptop;
    default:        return Monitor;
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 2)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function DevicesPage() {
  const { customer, token, loading } = useCustomerAuth();
  const navigate = useNavigate();
  const [devices,    setDevices]    = useState<TrustedDevice[]>([]);
  const [fetching,   setFetching]   = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [msg,        setMsg]        = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!loading && !customer) navigate('/login?reason=session_expired', { replace: true });
  }, [customer, loading, navigate]);

  useEffect(() => {
    if (!token) return;
    setFetching(true);
    fetch('/api/users/devices', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.devices) setDevices(data.devices); })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [token]);

  async function handleRevoke(deviceId: string) {
    if (!token || revokingId) return;
    setRevokingId(deviceId);
    setMsg(null);
    try {
      const res = await fetch('/api/users/devices/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ deviceId }),
      });
      if (res.ok) {
        setDevices(prev => prev.filter(d => d.id !== deviceId));
        setMsg({ text: 'Device removed successfully.', ok: true });
      } else {
        const d = await res.json().catch(() => ({}));
        setMsg({ text: d.error ?? 'Unable to remove device. Please try again.', ok: false });
      }
    } catch {
      setMsg({ text: 'Network error. Please try again.', ok: false });
    } finally {
      setRevokingId(null);
    }
  }

  if (loading || !customer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const trusted   = devices.filter(d => d.trusted);
  const untrusted = devices.filter(d => !d.trusted);

  return (
    <>
      <Helmet>
        <title>Trusted Devices — City Gate Capital</title>
        <meta name="description" content="Manage trusted devices on your City Gate Capital account." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://citygate.capital/dashboard/devices" />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        <h1 className="sr-only">Trusted Devices</h1>
        <header className="sticky top-0 z-40 border-b border-white/5 bg-[rgba(10,10,10,0.92)] backdrop-blur-xl">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
            <Link to="/dashboard/security"
              className="w-8 h-8 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-foreground/40 hover:text-foreground transition-colors">
              <ArrowLeft size={15} />
            </Link>
            <div className="flex items-center gap-2">
              <Smartphone size={15} style={{ color: '#C9A84C' }} />
              <span className="text-sm font-semibold text-foreground">Trusted Devices</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[10px] text-foreground/30 px-2.5 py-1 rounded-full border border-white/8">
                {devices.length} device{devices.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </header>

        <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">

          {/* Info banner */}
          <div className="flex items-start gap-3 p-4 rounded-2xl border border-white/6"
            style={{ background: 'rgba(201,168,76,0.04)' }}>
            <ShieldCheck size={14} style={{ color: '#C9A84C' }} className="mt-0.5 shrink-0" />
            <p className="text-xs text-foreground/50 leading-relaxed">
              Trusted devices can log in without additional verification for 30 days.
              Remove any device you don't recognise immediately.
            </p>
          </div>

          {/* Feedback message */}
          <AnimatePresence>
            {msg && (
              <motion.div
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className={`flex items-center gap-2 px-4 py-3 rounded-2xl border text-xs ${msg.ok ? 'border-emerald-500/20 bg-emerald-500/6 text-emerald-400' : 'border-red-500/20 bg-red-500/6 text-red-400'}`}>
                {msg.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                {msg.text}
              </motion.div>
            )}
          </AnimatePresence>

          {fetching ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={22} className="animate-spin text-foreground/20" />
            </div>
          ) : devices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <Monitor size={28} className="text-foreground/15" />
              <p className="text-sm text-foreground/40">No trusted devices</p>
              <p className="text-xs text-foreground/25">Devices are added when you choose "Trust this device" at login.</p>
            </div>
          ) : (
            <>
              {/* Current / trusted devices */}
              {trusted.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-semibold text-foreground/30 uppercase tracking-[0.12em]">
                    Trusted Devices ({trusted.length})
                  </p>
                  {trusted.map(device => {
                    const DevIcon = deviceIcon(device.type);
                    return (
                      <motion.div
                        key={device.id}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 p-4 rounded-2xl border border-white/6"
                        style={{ background: device.current ? 'rgba(201,168,76,0.04)' : 'rgba(255,255,255,0.02)' }}>
                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                          style={{ background: device.current ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.05)', border: `1px solid ${device.current ? 'rgba(201,168,76,0.25)' : 'rgba(255,255,255,0.08)'}` }}>
                          <DevIcon size={16} style={{ color: device.current ? '#C9A84C' : 'rgba(255,255,255,0.4)' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-foreground/80 truncate">{device.name || `${device.os} ${device.browser}`}</p>
                            {device.current && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shrink-0">
                                This device
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            {device.location && (
                              <span className="flex items-center gap-1 text-[10px] text-foreground/30">
                                <MapPin size={9} /> {device.location}
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-[10px] text-foreground/25">
                              <Globe size={9} /> {device.ip}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-foreground/25">
                              <Clock size={9} /> {timeAgo(device.lastSeen)}
                            </span>
                          </div>
                          <p className="text-[10px] text-foreground/20 mt-0.5">
                            Added {new Date(device.addedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        {!device.current && (
                          <button
                            onClick={() => handleRevoke(device.id)}
                            disabled={!!revokingId}
                            className="w-8 h-8 rounded-xl bg-red-500/8 border border-red-500/15 flex items-center justify-center text-red-400/60 hover:text-red-400 transition-colors disabled:opacity-40 shrink-0"
                            title="Remove device">
                            {revokingId === device.id
                              ? <Loader2 size={12} className="animate-spin" />
                              : <Trash2 size={12} />}
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Untrusted / session devices */}
              {untrusted.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-semibold text-foreground/30 uppercase tracking-[0.12em]">
                    Recent Sessions ({untrusted.length})
                  </p>
                  {untrusted.map(device => {
                    const DevIcon = deviceIcon(device.type);
                    return (
                      <div key={device.id}
                        className="flex items-center gap-3 p-4 rounded-2xl border border-white/5"
                        style={{ background: 'rgba(255,255,255,0.015)' }}>
                        <div className="w-10 h-10 rounded-2xl bg-white/4 border border-white/6 flex items-center justify-center shrink-0">
                          <DevIcon size={16} className="text-foreground/30" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground/60 truncate">{device.name || `${device.os} ${device.browser}`}</p>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            {device.location && (
                              <span className="flex items-center gap-1 text-[10px] text-foreground/25">
                                <MapPin size={9} /> {device.location}
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-[10px] text-foreground/20">
                              <Clock size={9} /> {timeAgo(device.lastSeen)}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRevoke(device.id)}
                          disabled={!!revokingId}
                          className="w-8 h-8 rounded-xl bg-red-500/8 border border-red-500/15 flex items-center justify-center text-red-400/60 hover:text-red-400 transition-colors disabled:opacity-40 shrink-0">
                          {revokingId === device.id
                            ? <Loader2 size={12} className="animate-spin" />
                            : <Trash2 size={12} />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Security tip */}
          <div className="flex items-start gap-3 px-4 py-3 rounded-2xl border border-white/5 bg-white/[0.015]">
            <AlertTriangle size={13} className="text-amber-400/60 mt-0.5 shrink-0" />
            <p className="text-[10px] text-foreground/30 leading-relaxed">
              If you see a device you don't recognise, remove it immediately and change your password.
              Contact support if you suspect unauthorised access.
            </p>
          </div>

          <Link to="/dashboard/security"
            className="flex items-center gap-1.5 text-xs text-foreground/30 hover:text-foreground/60 transition-colors w-fit">
            <ArrowLeft size={12} />
            Back to Security Centre
          </Link>
        </div>
      </div>
    </>
  );
}

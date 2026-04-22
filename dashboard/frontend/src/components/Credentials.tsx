import { useEffect, useMemo, useState } from 'react';
import { useDashboard } from '../store';

type FieldType = 'password' | 'text';

interface CredentialField {
  id: string;
  label: string;
  envVar: string;
  type: FieldType;
  placeholder?: string;
  /** Direct link to the page where THIS specific field is obtained, if different from the entry's docsUrl. */
  docsUrl?: string;
  /** Tiny per-field hint (one line) — shown next to the field link. */
  hint?: string;
}

interface CredentialEntry {
  id: string;
  provider: string;
  name: string;
  // What this credential lets you do — shown to the user so they know which
  // keys to ask for (e.g. WhatsApp "send" vs "receive").
  scope: string;
  // Direct link to the dashboard/page where this credential is issued.
  docsUrl?: string;
  // Short instruction (one or two sentences) on the path to find each field.
  howTo?: string;
  fields: CredentialField[];
}

const PROVIDERS: { id: string; label: string; color: string }[] = [
  { id: 'anthropic',  label: 'Anthropic',    color: 'oklch(0.72 0.16 40)'  },
  { id: 'supabase',   label: 'Supabase',     color: 'oklch(0.72 0.18 145)' },
  { id: 'snowflake',  label: 'Snowflake',    color: 'oklch(0.75 0.14 210)' },
  { id: 'google',     label: 'Google',       color: 'oklch(0.72 0.16 265)' },
  { id: 'openai',     label: 'OpenAI',       color: 'oklch(0.70 0.15 155)' },
  { id: 'github',     label: 'GitHub',       color: 'oklch(0.70 0.08 280)' },
  { id: 'search',     label: 'Search',       color: 'oklch(0.70 0.18 85)'  },
  { id: 'whatsapp',   label: 'WhatsApp',     color: 'oklch(0.74 0.16 150)' },
  { id: 'custom',     label: 'Custom',       color: 'oklch(0.65 0.10 220)' },
];

// Each credential declares its own fields — not every value is a "key".
// `scope` makes clear WHAT you can do with these credentials.
const DEFAULT_CREDENTIALS: CredentialEntry[] = [
  {
    id: 'anthropic',
    provider: 'anthropic',
    name: 'Anthropic API',
    scope: 'Read + write — run Claude models (all tiers, all endpoints)',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    howTo: 'Console → Settings → API Keys → Create Key. Copy once — it is not shown again.',
    fields: [
      { id: 'anthropic-key', label: 'API Key', envVar: 'ANTHROPIC_API_KEY', type: 'password', placeholder: 'sk-ant-...' },
    ],
  },
  {
    id: 'supabase-project',
    provider: 'supabase',
    name: 'Supabase Project',
    scope: 'Connect to project (URL + anon key for public reads, service role for full admin)',
    docsUrl: 'https://supabase.com/dashboard/project/_/settings/api',
    howTo: 'Dashboard → pick project → Project Settings → API. URL and both keys are on that page. Service role key bypasses RLS — never ship to a browser.',
    fields: [
      { id: 'supabase-url',          label: 'Project URL',         envVar: 'SUPABASE_URL',                type: 'text',     placeholder: 'https://xxx.supabase.co' },
      { id: 'supabase-anon',         label: 'Anon key',            envVar: 'SUPABASE_ANON_KEY',           type: 'password' },
      { id: 'supabase-key',          label: 'Service role key',    envVar: 'SUPABASE_SERVICE_ROLE_KEY',   type: 'password' },
    ],
  },
  {
    id: 'supabase-mgmt',
    provider: 'supabase',
    name: 'Supabase Management',
    scope: 'Manage projects via the Management API (migrations, edge functions, branches)',
    docsUrl: 'https://supabase.com/dashboard/account/tokens',
    howTo: 'Account → Access Tokens → Generate new token. Project ref is the subdomain of your project URL (e.g. xxx in xxx.supabase.co).',
    fields: [
      { id: 'supabase-access',       label: 'Access token',        envVar: 'SUPABASE_ACCESS_TOKEN',       type: 'password', placeholder: 'sbp_...' },
      { id: 'supabase-project-ref',  label: 'Project ref',         envVar: 'SUPABASE_PROJECT_REF',        type: 'text',     placeholder: 'rycybujjedtofghigyxm' },
    ],
  },
  {
    id: 'snowflake',
    provider: 'snowflake',
    name: 'Snowflake Warehouse',
    scope: 'Query the warehouse (SELECT/INSERT depending on role permissions)',
    docsUrl: 'https://docs.snowflake.com/en/user-guide/admin-account-identifier',
    howTo: 'Account = the identifier in your Snowflake URL (orgname-account). User/password from your Snowflake admin. Warehouse / database / role from your account admin or "SHOW WAREHOUSES" in the worksheet.',
    fields: [
      { id: 'snowflake-account',     label: 'Account',             envVar: 'SNOWFLAKE_ACCOUNT',           type: 'text',
        hint: 'the `orgname-account` segment of your Snowflake URL (e.g. FW64584-REECE from FW64584-REECE.snowflakecomputing.com)' },
      { id: 'snowflake-user',        label: 'User',                envVar: 'SNOWFLAKE_USER',              type: 'text',
        hint: 'your Snowflake login username — ask your admin if unsure' },
      { id: 'snowflake-password',    label: 'Password',            envVar: 'SNOWFLAKE_PASSWORD',          type: 'password',
        hint: 'issued by your Snowflake admin; reset in Snowsight → your name → My profile → Change password' },
      { id: 'snowflake-warehouse',   label: 'Warehouse',           envVar: 'SNOWFLAKE_WAREHOUSE',         type: 'text',
        hint: 'run `SHOW WAREHOUSES` in a worksheet to list available ones' },
      { id: 'snowflake-database',    label: 'Database',            envVar: 'SNOWFLAKE_DATABASE',          type: 'text',
        hint: 'run `SHOW DATABASES` to list; common default is ODS' },
      { id: 'snowflake-role',        label: 'Role',                envVar: 'SNOWFLAKE_ROLE',              type: 'text',
        hint: 'run `SHOW ROLES` or ask your admin which role your user is granted' },
    ],
  },
  {
    id: 'google-calendar',
    provider: 'google',
    name: 'Google (Calendar / Drive / Gmail OAuth)',
    scope: 'Read + write on the connected Google account — scopes the refresh token was minted with (per-user OAuth, not service account)',
    docsUrl: 'https://console.cloud.google.com/apis/credentials',
    howTo: 'One-time: Cloud Console → APIs & Services → Credentials → OAuth client (Web). Add `https://developers.google.com/oauthplayground` to Authorized redirect URIs. Then mint the refresh token at the Playground with the scopes you need.',
    fields: [
      {
        id: 'google-client-id', label: 'Client ID', envVar: 'GOOGLE_CLIENT_ID', type: 'text',
        placeholder: 'xxx.apps.googleusercontent.com',
        docsUrl: 'https://console.cloud.google.com/apis/credentials',
        hint: 'Cloud Console → APIs & Services → Credentials → your OAuth client',
      },
      {
        id: 'google-client-secret', label: 'Client secret', envVar: 'GOOGLE_CLIENT_SECRET', type: 'password',
        placeholder: 'GOCSPX-...',
        docsUrl: 'https://console.cloud.google.com/apis/credentials',
        hint: 'same OAuth client as the ID above',
      },
      {
        id: 'google-refresh-token', label: 'Refresh token', envVar: 'GOOGLE_REFRESH_TOKEN', type: 'password',
        placeholder: '1//0g...',
        docsUrl: 'https://developers.google.com/oauthplayground/',
        hint: 'OAuth Playground → gear → use own creds → scope → Authorize → Exchange',
      },
    ],
  },
  {
    id: 'openai',
    provider: 'openai',
    name: 'OpenAI API',
    scope: 'Call OpenAI models (chat, embeddings, images — whatever the key allows)',
    docsUrl: 'https://platform.openai.com/api-keys',
    howTo: 'Platform → API keys → Create new secret key. Pick a project; key is shown once.',
    fields: [
      { id: 'openai-key',            label: 'API Key',             envVar: 'OPENAI_API_KEY',              type: 'password', placeholder: 'sk-...' },
    ],
  },
  {
    id: 'github',
    provider: 'github',
    name: 'GitHub',
    scope: 'Repo access — scope depends on the PAT (repo:read, repo:write, workflow, etc.)',
    docsUrl: 'https://github.com/settings/tokens',
    howTo: 'Settings → Developer settings → Personal access tokens. Prefer fine-grained tokens scoped to specific repos. For full repo + workflow access, classic PAT with "repo" + "workflow" scopes.',
    fields: [
      { id: 'github-token',          label: 'Personal access token', envVar: 'GITHUB_TOKEN',              type: 'password', placeholder: 'ghp_... or github_pat_...' },
    ],
  },
  {
    id: 'brave',
    provider: 'search',
    name: 'Brave Search',
    scope: 'Web + local search via Brave Search API',
    docsUrl: 'https://api-dashboard.search.brave.com/app/keys',
    howTo: 'Brave Search API dashboard → Subscriptions (free tier: 1 query/sec, 2,000/month) → API Keys → Add API Key.',
    fields: [
      { id: 'brave-key',             label: 'API Key',             envVar: 'BRAVE_API_KEY',               type: 'password' },
    ],
  },
  {
    id: 'firecrawl',
    provider: 'search',
    name: 'Firecrawl',
    scope: 'Crawl + scrape pages into clean markdown',
    docsUrl: 'https://www.firecrawl.dev/app/api-keys',
    howTo: 'Firecrawl app → API Keys → Create API Key. Free tier includes 500 credits.',
    fields: [
      { id: 'firecrawl-key',         label: 'API Key',             envVar: 'FIRECRAWL_API_KEY',           type: 'password', placeholder: 'fc-...' },
    ],
  },
  {
    id: 'whatsapp-receive',
    provider: 'whatsapp',
    name: 'WhatsApp — Receive',
    scope: 'Receive inbound messages via webhook (webhook verification only)',
    docsUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks',
    howTo: 'Meta App → WhatsApp → Configuration → Webhooks. The verify token is a string YOU choose (Meta echoes it back during handshake).',
    fields: [
      {
        id: 'wa-verify-token', label: 'Webhook verify token', envVar: 'WHATSAPP_WEBHOOK_VERIFY_TOKEN', type: 'password',
        placeholder: 'your chosen token',
        hint: 'you invent this; Meta echoes it back during handshake — no URL to fetch it from',
      },
      {
        id: 'wa-phone-id', label: 'Phone number ID', envVar: 'WHATSAPP_PHONE_NUMBER_ID', type: 'text',
        docsUrl: 'https://developers.facebook.com/apps',
        hint: 'your app → WhatsApp → API Setup',
      },
    ],
  },
  {
    id: 'whatsapp-send',
    provider: 'whatsapp',
    name: 'WhatsApp — Send',
    scope: 'Send outbound messages via Cloud API (requires Meta app + system user token)',
    docsUrl: 'https://business.facebook.com/settings/system-users',
    howTo: 'Each field lives in a different Meta surface — use the per-field links below.',
    fields: [
      {
        id: 'wa-access-token', label: 'System user access token', envVar: 'WHATSAPP_ACCESS_TOKEN', type: 'password',
        placeholder: 'EAAG...',
        docsUrl: 'https://business.facebook.com/settings/system-users',
        hint: 'Business Settings → System Users → Add → Generate token (scopes: whatsapp_business_messaging + _management)',
      },
      {
        id: 'wa-app-id', label: 'Meta App ID', envVar: 'WHATSAPP_APP_ID', type: 'text',
        docsUrl: 'https://developers.facebook.com/apps',
        hint: 'pick your app — the App ID is shown in the header',
      },
      {
        id: 'wa-business-id', label: 'Business account ID', envVar: 'WHATSAPP_BUSINESS_ACCOUNT_ID', type: 'text',
        docsUrl: 'https://business.facebook.com/settings/info',
        hint: 'Business Settings → Business Info → Business account ID',
      },
    ],
  },
];

type ClaudeAuthStatus = {
  loggedIn: boolean;
  authMethod?: string;
  apiProvider?: string;
  apiKeySource?: string;
  email?: string | null;
  subscriptionType?: string | null;
  envKeySet?: boolean;
  error?: string;
};

function ClaudeSubscriptionPanel() {
  const [status, setStatus] = useState<ClaudeAuthStatus | null>(null);
  const [phase, setPhase] = useState<'idle' | 'starting' | 'awaiting' | 'error'>('idle');
  const [url, setUrl] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const r = await fetch('/api/claude-auth/status');
      const d = await r.json();
      setStatus(d);
      return d as ClaudeAuthStatus;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  // Poll while waiting for the OAuth callback to land.
  useEffect(() => {
    if (phase !== 'awaiting') return;
    const t = window.setInterval(async () => {
      const d = await refresh();
      if (d?.loggedIn && d.authMethod === 'claude.ai') {
        setPhase('idle');
        setUrl(null);
      }
    }, 2000);
    return () => window.clearInterval(t);
  }, [phase]);

  const startLogin = async () => {
    setPhase('starting');
    setErrMsg(null);
    try {
      const r = await fetch('/api/claude-auth/login', { method: 'POST' });
      const d = await r.json();
      if (!r.ok || !d.url) {
        setPhase('error');
        setErrMsg(d.error || 'failed to start login');
        return;
      }
      setUrl(d.url);
      setPhase('awaiting');
      window.open(d.url, '_blank', 'noopener');
    } catch (e) {
      setPhase('error');
      setErrMsg(String(e));
    }
  };

  const signOut = async () => {
    try {
      await fetch('/api/claude-auth/logout', { method: 'POST' });
    } finally {
      await refresh();
      setPhase('idle');
      setUrl(null);
    }
  };

  const subActive = status?.loggedIn && status?.authMethod === 'claude.ai';

  return (
    <div className="credentials__sub-panel">
      <div className="credentials__sub-panel-head">
        <span className="credentials__sub-panel-title">Claude subscription (Pro / Max)</span>
        {subActive ? (
          <button className="credentials__test-btn credentials__test-btn--pass" onClick={signOut}>
            sign out
          </button>
        ) : (
          <button
            className="credentials__save-btn"
            onClick={startLogin}
            disabled={phase === 'starting' || phase === 'awaiting'}
          >
            {phase === 'starting' ? 'starting…' : phase === 'awaiting' ? 'waiting for browser…' : 'use subscription'}
          </button>
        )}
      </div>
      {subActive && (
        <div className="credentials__sub-panel-line">
          ✓ Signed in
          {status?.email ? <> as <strong>{status.email}</strong></> : null}
          {status?.subscriptionType ? <> · plan: {status.subscriptionType}</> : null}
          {status?.envKeySet && (
            <span className="credentials__sub-panel-warn">
              {' '}— ANTHROPIC_API_KEY is set in env, which overrides subscription auth at runtime. Clear it from dotfiles if you want chat to use your subscription quota.
            </span>
          )}
        </div>
      )}
      {!subActive && phase === 'awaiting' && url && (
        <div className="credentials__sub-panel-line">
          A browser tab opened. If it didn't,{' '}
          <a href={url} target="_blank" rel="noreferrer noopener" className="credentials__howto-link">
            click here ↗
          </a>{' '}
          to finish signing in. This panel will update automatically.
        </div>
      )}
      {phase === 'error' && errMsg && (
        <div className="credentials__test-error">{errMsg}</div>
      )}
      {!subActive && phase === 'idle' && (
        <div className="credentials__sub-panel-line credentials__sub-panel-hint">
          Sign in with your Anthropic account instead of pasting an API key. Same flow as <code>claude auth login</code>.
        </div>
      )}
    </div>
  );
}

export function CredentialsButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="credentials__trigger" onClick={onClick} title="Credentials">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
      </svg>
    </button>
  );
}

type FieldValues = Record<string, string>;
type TestState = { status: 'idle' | 'testing' | 'pass' | 'fail'; message?: string };

type SaveState = { status: 'idle' | 'saving' | 'saved' | 'error'; message?: string };

export function Credentials({ onClose }: { onClose: () => void }) {
  const { tools, sendChatMessage } = useDashboard();

  // Per-field input state, keyed by field id.
  const [values, setValues] = useState<FieldValues>({});

  // Track which envVars have been set this session to flip the indicator.
  const [sessionSet, setSessionSet] = useState<Record<string, boolean>>({});

  // Per-entry test state (idle | testing | pass | fail + last message).
  const [tests, setTests] = useState<Record<string, TestState>>({});

  // Per-entry save state (idle | saving | saved | error + last message).
  const [saves, setSaves] = useState<Record<string, SaveState>>({});

  // Custom entries added at runtime.
  const [customEntries, setCustomEntries] = useState<CredentialEntry[]>([]);
  const [customName, setCustomName] = useState('');
  const [customEnv, setCustomEnv] = useState('');
  const [customScope, setCustomScope] = useState('');

  const allEntries = useMemo(() => [...DEFAULT_CREDENTIALS, ...customEntries], [customEntries]);

  // Source-of-truth for "is this field set?" — the bridge reports which env
  // vars are present in its process.env (dotfiles + Codespace secrets, merged).
  // The static `tools` array has stale `configured` flags and doesn't include
  // every field we care about, so we query the bridge directly.
  const [envPresence, setEnvPresence] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const envVars = Array.from(new Set(allEntries.flatMap(e => e.fields.map(f => f.envVar))));
    if (envVars.length === 0) return;
    let cancelled = false;
    fetch('/api/credentials/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ envVars }),
    })
      .then(r => r.json())
      .then(j => { if (!cancelled && j?.ok) setEnvPresence(j.envVars || {}); })
      .catch(() => { /* bridge unreachable — fall back to tools registry */ });
    return () => { cancelled = true; };
  }, [allEntries]);

  function isFieldSet(envVar: string) {
    if (sessionSet[envVar]) return true;
    if (envPresence[envVar]) return true;
    const tool = tools.find(t => t.envVar === envVar);
    return tool ? tool.configured === 'ready' : false;
  }

  // Expand provider if it has any unset field.
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const out: Record<string, boolean> = {};
    for (const p of PROVIDERS) {
      const entries = DEFAULT_CREDENTIALS.filter(e => e.provider === p.id);
      const anyUnset = entries.some(e =>
        e.fields.some(f => {
          const tool = tools.find(t => t.envVar === f.envVar);
          return !tool || tool.configured !== 'ready';
        })
      );
      out[p.id] = anyUnset || entries.length === 0;
    }
    return out;
  });

  function toggle(providerId: string) {
    setExpanded(prev => ({ ...prev, [providerId]: !prev[providerId] }));
  }

  async function handleSaveEntry(entry: CredentialEntry) {
    const filled = entry.fields.filter(f => (values[f.id] || '').trim());
    if (filled.length === 0) return;
    const payload = filled.map(f => ({ envVar: f.envVar, value: (values[f.id] || '').trim() }));
    setSaves(prev => ({ ...prev, [entry.id]: { status: 'saving' } }));
    try {
      const resp = await fetch('/api/credentials/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: payload }),
      });
      const data = await resp.json() as {
        ok: boolean;
        saved?: string[];
        staged?: string[];
        verified?: string[];
        missing?: string[];
        commit?: string | null;
        committed?: boolean;
        pushed?: boolean;
        commitOutput?: string;
        pushOutput?: string;
        error?: string;
      };
      if (data.ok) {
        const shortSha = data.commit ? data.commit.slice(0, 7) : '';
        setSaves(prev => ({
          ...prev,
          [entry.id]: {
            status: 'saved',
            message: `Saved ${(data.saved || []).join(', ')} · committed ${shortSha} · pushed to dotfiles`,
          },
        }));
        setSessionSet(prev => {
          const next = { ...prev };
          for (const f of filled) next[f.envVar] = true;
          return next;
        });
        setValues(prev => {
          const next = { ...prev };
          for (const f of filled) delete next[f.id];
          return next;
        });
        return;
      }
      // Partial / failed: tell the user exactly what happened and what to fix.
      const parts: string[] = [];
      if (data.staged?.length) parts.push(`Staged locally: ${data.staged.join(', ')}`);
      if (!data.committed) parts.push(`Commit failed: ${(data.commitOutput || '').trim().split('\n').pop() || 'unknown'}`);
      else if (!data.pushed) parts.push(`Push failed: ${(data.pushOutput || '').trim().split('\n').pop() || 'unknown'}`);
      if (data.missing?.length) parts.push(`Missing from file: ${data.missing.join(', ')}`);
      if (data.error) parts.push(data.error);
      const msg = parts.join(' · ') || 'Save did not complete';
      setSaves(prev => ({ ...prev, [entry.id]: { status: 'error', message: msg } }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSaves(prev => ({ ...prev, [entry.id]: { status: 'error', message: `Bridge unreachable: ${msg}` } }));
    }
  }

  async function handleTestEntry(entry: CredentialEntry) {
    // Build a fields map from anything the user typed this turn. Empty values
    // are omitted — the bridge falls back to process.env for those.
    const fieldPayload: Record<string, string> = {};
    for (const f of entry.fields) {
      const v = (values[f.id] || '').trim();
      if (v) fieldPayload[f.envVar] = v;
    }
    setTests(prev => ({ ...prev, [entry.id]: { status: 'testing' } }));
    try {
      const resp = await fetch('/api/credentials/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId: entry.id, fields: fieldPayload }),
      });
      const data = await resp.json() as {
        ok: boolean; message?: string; error?: string; status?: number; details?: string;
      };
      if (data.ok) {
        setTests(prev => ({ ...prev, [entry.id]: { status: 'pass', message: data.message || 'OK' } }));
        return;
      }
      const errLine = data.error || 'Test failed';
      const statusPart = data.status ? ` (HTTP ${data.status})` : '';
      const detailsPart = data.details ? `\n\nResponse body:\n\`\`\`\n${data.details}\n\`\`\`` : '';
      setTests(prev => ({ ...prev, [entry.id]: { status: 'fail', message: errLine + statusPart } }));
      // Hand off to chat so Claude can diagnose and guide the fix.
      sendChatMessage(
        `Credentials test failed for **${entry.name}** (\`${entry.id}\`).\n\n` +
        `**Scope:** ${entry.scope}\n` +
        `**Fields:** ${entry.fields.map(f => f.envVar).join(', ')}\n` +
        `**Error:** ${errLine}${statusPart}${detailsPart}\n\n` +
        `Please help me figure out what's wrong — is it a wrong value, missing scope, expired token, or something else?`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTests(prev => ({ ...prev, [entry.id]: { status: 'fail', message: msg } }));
      sendChatMessage(
        `Credentials test for **${entry.name}** could not reach the bridge. Error: ${msg}. ` +
        `Is the bridge running? (expected at /api/credentials/test)`
      );
    }
  }

  function handleAddCustom() {
    if (!customName.trim() || !customEnv.trim()) return;
    const envVar = customEnv.trim().toUpperCase().replace(/\s+/g, '_');
    const id = `custom-${Date.now()}`;
    setCustomEntries(prev => [...prev, {
      id,
      provider: 'custom',
      name: customName.trim(),
      scope: customScope.trim() || 'Custom credential',
      fields: [{ id, label: 'Value', envVar, type: 'password' }],
    }]);
    setExpanded(prev => ({ ...prev, custom: true }));
    setCustomName('');
    setCustomEnv('');
    setCustomScope('');
  }

  // Group entries by provider in PROVIDERS order.
  const grouped = useMemo(() => {
    const byProvider = new Map<string, CredentialEntry[]>();
    for (const entry of allEntries) {
      const arr = byProvider.get(entry.provider) || [];
      arr.push(entry);
      byProvider.set(entry.provider, arr);
    }
    return PROVIDERS.map(p => ({
      provider: p,
      entries: byProvider.get(p.id) || [],
    })).filter(g => g.entries.length > 0 || g.provider.id === 'custom');
  }, [allEntries]);

  return (
    <div className="credentials__overlay" onClick={onClose}>
      <div className="credentials__box" onClick={e => e.stopPropagation()}>
        <div className="credentials__header">
          <span className="credentials__title">Credentials</span>
          <button className="credentials__close" onClick={onClose}>&times;</button>
        </div>

        <div className="credentials__list">
          {grouped.map(({ provider, entries }) => {
            const totalFields = entries.reduce((n, e) => n + e.fields.length, 0);
            const setFields = entries.reduce(
              (n, e) => n + e.fields.filter(f => isFieldSet(f.envVar)).length,
              0
            );
            const isOpen = expanded[provider.id];
            return (
              <div key={provider.id} className="credentials__group">
                <button
                  className="credentials__group-header"
                  onClick={() => toggle(provider.id)}
                  style={{ borderLeftColor: provider.color }}
                >
                  <span className={`credentials__chevron ${isOpen ? 'credentials__chevron--open' : ''}`}>▸</span>
                  <span className="credentials__group-label">{provider.label}</span>
                  <span className="credentials__group-count">
                    {totalFields === 0
                      ? 'add custom credentials below'
                      : `${setFields}/${totalFields}`}
                  </span>
                </button>

                {isOpen && entries.map(entry => {
                  const entrySetCount = entry.fields.filter(f => isFieldSet(f.envVar)).length;
                  const entryComplete = entrySetCount === entry.fields.length;
                  const test = tests[entry.id] || { status: 'idle' as const };
                  const save = saves[entry.id] || { status: 'idle' as const };
                  const hasInput = entry.fields.some(f => (values[f.id] || '').trim());
                  // Test is available if the user has any input OR every required field is already set.
                  const canTest = hasInput || entryComplete;
                  return (
                  <div key={entry.id} className="credentials__entry">
                    <div className="credentials__entry-head">
                      <div className="credentials__entry-title">
                        <span
                          className={`credentials__entry-status credentials__entry-status--${entryComplete ? 'complete' : entrySetCount > 0 ? 'partial' : 'empty'}`}
                          title={entryComplete ? 'All fields set' : `${entrySetCount} of ${entry.fields.length} set`}
                        />
                        <span className="credentials__key-name">{entry.name}</span>
                      </div>
                      <div className="credentials__entry-actions">
                        <button
                          className={`credentials__test-btn credentials__test-btn--${test.status}`}
                          onClick={() => handleTestEntry(entry)}
                          disabled={!canTest || test.status === 'testing'}
                          title={
                            test.status === 'pass' ? test.message :
                            test.status === 'fail' ? test.message :
                            'Check that these credentials actually work against the provider'
                          }
                        >
                          {test.status === 'testing' ? 'testing…'
                            : test.status === 'pass' ? '✓ valid'
                            : test.status === 'fail' ? '✗ retry test'
                            : 'test'}
                        </button>
                        <button
                          className={`credentials__save-btn credentials__save-btn--${save.status}`}
                          onClick={() => handleSaveEntry(entry)}
                          disabled={!hasInput || save.status === 'saving'}
                          title={save.status === 'error' ? save.message : save.status === 'saved' ? save.message : 'Write to dotfiles, commit, push, and verify'}
                        >
                          {save.status === 'saving' ? 'saving…'
                            : save.status === 'saved' ? '✓ saved'
                            : save.status === 'error' ? '✗ retry save'
                            : 'save'}
                        </button>
                      </div>
                    </div>
                    {test.status === 'fail' && test.message && (
                      <div className="credentials__test-error">
                        {test.message} — sent to chat for help.
                      </div>
                    )}
                    {save.status === 'error' && save.message && (
                      <div className="credentials__test-error">
                        {save.message}
                      </div>
                    )}
                    {save.status === 'saved' && save.message && (
                      <div className="credentials__save-ok">
                        {save.message}
                      </div>
                    )}
                    {entry.id === 'anthropic' && <ClaudeSubscriptionPanel />}
                    <div className="credentials__scope">
                      <span className="credentials__scope-label">Grants:</span> {entry.scope}
                    </div>
                    {(entry.docsUrl || entry.howTo) && (
                      <div className="credentials__howto">
                        <span className="credentials__howto-label">Where:</span>
                        {entry.howTo && <span className="credentials__howto-text"> {entry.howTo}</span>}
                        {entry.docsUrl && (
                          <a
                            className="credentials__howto-link"
                            href={entry.docsUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            open page ↗
                          </a>
                        )}
                      </div>
                    )}
                    {entry.fields.map(field => {
                      const setAlready = isFieldSet(field.envVar);
                      const defaultPlaceholder = field.type === 'password'
                        ? `paste ${field.label.toLowerCase()}…`
                        : `enter ${field.label.toLowerCase()}…`;
                      return (
                        <div key={field.id} className="credentials__field">
                          <div className="credentials__row-info">
                            <span className={`credentials__dot credentials__dot--${setAlready ? 'set' : 'unset'}`} />
                            <span className="credentials__field-label">{field.label}</span>
                            <span className="credentials__env-var">{field.envVar}</span>
                            {field.docsUrl && (
                              <a
                                className="credentials__howto-link"
                                href={field.docsUrl}
                                target="_blank"
                                rel="noreferrer noopener"
                                title={field.hint}
                              >
                                where ↗
                              </a>
                            )}
                          </div>
                          {field.hint && (
                            <div className="credentials__field-hint">{field.hint}</div>
                          )}
                          <input
                            type={field.type === 'password' ? 'password' : 'text'}
                            className="credentials__input"
                            placeholder={setAlready && !values[field.id]
                              ? (field.type === 'password' ? '•••••••• (already set)' : 'already set')
                              : (field.placeholder || defaultPlaceholder)
                            }
                            value={values[field.id] || ''}
                            onChange={e => setValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && handleSaveEntry(entry)}
                          />
                        </div>
                      );
                    })}
                  </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Add a custom credential */}
        <div className="credentials__add">
          <input
            className="credentials__input credentials__input--half"
            placeholder="Name (e.g. Postmark)"
            value={customName}
            onChange={e => setCustomName(e.target.value)}
          />
          <input
            className="credentials__input credentials__input--half"
            placeholder="ENV_VAR"
            value={customEnv}
            onChange={e => setCustomEnv(e.target.value)}
          />
          <input
            className="credentials__input"
            placeholder="What does it grant access to?"
            value={customScope}
            onChange={e => setCustomScope(e.target.value)}
          />
          <button
            className="credentials__save-btn"
            onClick={handleAddCustom}
            disabled={!customName.trim() || !customEnv.trim()}
          >
            + add
          </button>
        </div>

        <div className="credentials__footer">
          Save writes to your dotfiles .env, commits, pushes to origin, and grep-verifies before reporting success. Nothing is sent through chat.
        </div>
      </div>
    </div>
  );
}

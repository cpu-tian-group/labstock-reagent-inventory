'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Beaker,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  FlaskConical,
  Grid2X2,
  History,
  KeyRound,
  Layers3,
  MapPin,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  SlidersHorizontal,
  Tag,
  Thermometer,
  Trash2,
  UserRound,
  UsersRound,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { categoryFilters } from './reagent-utils';

type ReagentStatus = '充足' | '偏低' | '即将过期';

type Reagent = {
  id: number;
  name: string;
  alias: string;
  cas: string;
  category: string;
  location: string;
  storageTemp: string;
  stock: number;
  unit: string;
  threshold: number;
  status: ReagentStatus;
  supplier: string;
  updated: string;
  expiry: string;
  notes: string;
};

type ModelContextLike = {
  registerTool: (
    tool: {
      name: string;
      title?: string;
      description: string;
      inputSchema: Record<string, unknown>;
      execute: (input: unknown) => unknown;
      annotations?: {
        readOnlyHint?: boolean;
        untrustedContentHint?: boolean;
      };
    },
    options?: { signal?: AbortSignal },
  ) => void | Promise<void>;
};

const initialReagents: Reagent[] = [];

const emptyDraft = {
  name: '',
  alias: '',
  cas: '',
  category: '其他',
  location: '',
  storageTemp: '待确认',
  stock: '',
  unit: '瓶',
  supplier: '',
  expiry: '',
  notes: '',
};

function toWritePayload(input: Partial<typeof emptyDraft>) {
  const parsedStock = Number(input.stock);
  return {
    name: input.name?.trim() ?? '',
    alias: input.alias?.trim() ?? '',
    cas: input.cas?.trim() ?? '',
    category: input.category ?? '其他',
    location: input.location?.trim() ?? '',
    storageTemp: input.storageTemp?.trim() ?? '待确认',
    stock: Number.isFinite(parsedStock) && parsedStock >= 0 ? parsedStock : 0,
    unit: input.unit ?? '瓶',
    supplier: input.supplier?.trim() ?? '',
    expiry: input.expiry ?? '',
    notes: input.notes?.trim() ?? '',
  };
}

async function saveReagentRequest(
  path: string,
  method: 'POST' | 'PATCH',
  input: Partial<typeof emptyDraft>,
) {
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toWritePayload(input)),
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => ({}))) as {
    reagent?: Reagent;
    error?: string;
  };
  if (!response.ok || !payload.reagent) {
    throw new Error(payload.error || '共享试剂库暂时不可用');
  }
  return payload.reagent;
}

async function deleteReagentRequest(id: number) {
  const response = await fetch(`/api/reagents/${id}`, {
    method: 'DELETE',
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  if (!response.ok) throw new Error(payload.error || '删除试剂失败');
}

type InviteGateProps = {
  status: 'loading' | 'locked';
  code: string;
  error: string;
  submitting: boolean;
  onCodeChange: (value: string) => void;
  onSubmit: (event: React.SubmitEvent<HTMLFormElement>) => void;
};

function InviteGate({
  status,
  code,
  error,
  submitting,
  onCodeChange,
  onSubmit,
}: InviteGateProps) {
  const isLoading = status === 'loading';
  return (
    <main className="invite-gate-shell">
      <section className="invite-gate-card" aria-labelledby="invite-title">
        <div className="invite-gate-mark" aria-hidden="true">
          <FlaskConical size={25} strokeWidth={2.4} />
        </div>
        <p className="invite-gate-kicker">LABSTOCK · GROUP ACCESS</p>
        <h1 id="invite-title">进入课题组试剂库</h1>
        <p className="invite-gate-copy">
          {isLoading
            ? '正在检查访问状态…'
            : '输入课题组邀请码后即可查看和管理共享试剂。'}
        </p>
        {isLoading ? (
          <div className="invite-gate-loading" aria-live="polite">
            <RefreshCw size={18} className="spin-icon" />
            正在连接共享试剂库
          </div>
        ) : (
          <form className="invite-form" onSubmit={onSubmit}>
            <label htmlFor="group-invite-code">课题组邀请码</label>
            <div className="invite-input-wrap">
              <KeyRound size={17} aria-hidden="true" />
              <Input
                id="group-invite-code"
                type="password"
                value={code}
                onChange={(event) => onCodeChange(event.target.value)}
                placeholder="请输入邀请码"
                autoComplete="off"
                required
              />
            </div>
            {error && (
              <p className="invite-error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="invite-submit" disabled={submitting}>
              {submitting ? <RefreshCw size={16} className="spin-icon" /> : <KeyRound size={16} />}
              {submitting ? '验证中…' : '进入试剂库'}
            </Button>
          </form>
        )}
        <p className="invite-gate-footnote">仅限课题组成员使用 · 数据实时共享</p>
      </section>
    </main>
  );
}

function reagentMatches(reagent: Reagent, query: string, category: string) {
  const searchable = [
    reagent.name,
    reagent.alias,
    reagent.cas,
    reagent.category,
    reagent.location,
    reagent.storageTemp,
    reagent.supplier,
  ]
    .join(' ')
    .toLowerCase();
  return (
    (category === '全部' || reagent.category === category) &&
    (!query || searchable.includes(query.trim().toLowerCase()))
  );
}

const statusStyle: Record<
  ReagentStatus,
  { chip: string; dot: string; bar: string; icon: typeof CheckCircle2 }
> = {
  充足: {
    chip: 'status-good',
    dot: 'bg-emerald-500',
    bar: 'bg-emerald-500',
    icon: CheckCircle2,
  },
  偏低: {
    chip: 'status-low',
    dot: 'bg-amber-500',
    bar: 'bg-amber-500',
    icon: AlertTriangle,
  },
  即将过期: {
    chip: 'status-expiry',
    dot: 'bg-rose-500',
    bar: 'bg-rose-500',
    icon: Clock3,
  },
};

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(
    value,
  );
}

function getStockPercent(reagent: Reagent) {
  if (reagent.threshold <= 0) return reagent.stock > 0 ? 78 : 12;
  return Math.min(
    100,
    Math.max(12, (reagent.stock / (reagent.threshold * 3)) * 100),
  );
}

function getStockCaption(reagent: Reagent) {
  return reagent.threshold > 0
    ? `补货线 ${formatNumber(reagent.threshold)} ${reagent.unit}`
    : '数量按表内标记';
}

function getCategoryTone(category: string) {
  const tones: Record<string, string> = {
    '药物/抗生素': 'category-blue',
    天然产物: 'category-amber',
    '氨基酸/缓冲液': 'category-cyan',
    '蛋白/酶': 'category-violet',
    '染料/显色': 'category-pink',
    '核酸/脂质': 'category-green',
    有机合成: 'category-slate',
    其他: 'category-slate',
  };
  return tones[category] ?? 'category-slate';
}

export default function Home() {
  const [reagents, setReagents] = useState(initialReagents);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('全部');
  const [selected, setSelected] = useState<Reagent | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [accessState, setAccessState] = useState<'loading' | 'locked' | 'authorized'>('loading');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [syncState, setSyncState] = useState<'loading' | 'ready' | 'offline'>('loading');
  const reagentsRef = useRef(reagents);

  useEffect(() => {
    reagentsRef.current = reagents;
  }, [reagents]);

  useEffect(() => {
    let active = true;
    const checkInviteAccess = async () => {
      try {
        const response = await fetch('/api/access', { cache: 'no-store' });
        const payload = (await response.json().catch(() => ({}))) as {
          authenticated?: boolean;
        };
        if (!response.ok) throw new Error('access service unavailable');
        if (active) {
          setAccessState(payload.authenticated ? 'authorized' : 'locked');
        }
      } catch {
        if (active) {
          setAccessState('locked');
          setInviteError('暂时无法连接邀请码服务，请稍后重试。');
        }
      }
    };

    void checkInviteAccess();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (accessState !== 'authorized') return;
    let active = true;
    const loadSharedInventory = async () => {
      try {
        const response = await fetch('/api/reagents', { cache: 'no-store' });
        const payload = (await response.json().catch(() => ({}))) as {
          reagents?: Reagent[];
          error?: string;
        };
        if (response.status === 401) {
          if (active) {
            setAccessState('locked');
            setSyncState('offline');
          }
          return;
        }
        if (!response.ok || !Array.isArray(payload.reagents)) {
          throw new Error(payload.error || 'shared inventory unavailable');
        }
        if (active) {
          setReagents(payload.reagents);
          setSyncState('ready');
        }
      } catch {
        if (active) setSyncState('offline');
      }
    };

    void loadSharedInventory();
    return () => {
      active = false;
    };
  }, [accessState]);

  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContextLike })
      .modelContext;
    if (!context?.registerTool) return;

    const lifecycle = new AbortController();
    const registerTools = async () => {
      try {
        await context.registerTool(
          {
            name: 'search_reagents',
            title: 'Search laboratory reagents',
            description:
              'Search the visible laboratory reagent inventory by name, CAS number, location, supplier, or category.',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string' },
                category: { type: 'string', enum: categoryFilters },
              },
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            execute(input) {
              const values =
                typeof input === 'object' && input !== null
                  ? (input as Record<string, unknown>)
                  : {};
              const query = typeof values.query === 'string' ? values.query : '';
              const category =
                typeof values.category === 'string' ? values.category : '全部';
              if (!categoryFilters.includes(category)) {
                throw new Error('分类不在可选范围内');
              }
              const matches = reagentsRef.current.filter((reagent) =>
                reagentMatches(reagent, query, category),
              );
              setSearch(query);
              setActiveCategory(category);
              return {
                query,
                category,
                count: matches.length,
                reagents: matches.map(({ id, name, cas, location, stock, unit }) => ({
                  id,
                  name,
                  cas,
                  location,
                  stock,
                  unit,
                })),
              };
            },
          },
          { signal: lifecycle.signal },
        );

        await context.registerTool(
          {
            name: 'add_reagent',
            title: 'Add a laboratory reagent',
            description:
              'Add a new reagent to the current inventory. The visible list updates immediately.',
            inputSchema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                alias: { type: 'string' },
                cas: { type: 'string' },
                category: { type: 'string', enum: categoryFilters.slice(1) },
                location: { type: 'string' },
                storageTemp: { type: 'string' },
                stock: { type: 'number', minimum: 0 },
                unit: { type: 'string' },
                supplier: { type: 'string' },
                expiry: { type: 'string' },
                notes: { type: 'string' },
              },
              required: ['name'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            async execute(input) {
              const values =
                typeof input === 'object' && input !== null
                  ? (input as Record<string, unknown>)
                  : {};
              const category =
                typeof values.category === 'string' &&
                categoryFilters.slice(1).includes(values.category)
                  ? values.category
                  : '其他';
              const newReagent = await saveReagentRequest('/api/reagents', 'POST', {
                name: typeof values.name === 'string' ? values.name : '',
                alias: typeof values.alias === 'string' ? values.alias : '',
                cas: typeof values.cas === 'string' ? values.cas : '',
                category,
                location: typeof values.location === 'string' ? values.location : '',
                storageTemp:
                  typeof values.storageTemp === 'string'
                    ? values.storageTemp
                    : '待确认',
                stock: typeof values.stock === 'number' ? String(values.stock) : '',
                unit: typeof values.unit === 'string' ? values.unit : '瓶',
                supplier: typeof values.supplier === 'string' ? values.supplier : '',
                expiry: typeof values.expiry === 'string' ? values.expiry : '',
                notes: typeof values.notes === 'string' ? values.notes : '',
              });
              setReagents((current) => [newReagent, ...current]);
              return {
                id: newReagent.id,
                name: newReagent.name,
                location: newReagent.location,
                status: newReagent.status,
              };
            },
          },
          { signal: lifecycle.signal },
        );
      } catch {
        // Unsupported browsers can continue using the visible interface.
      }
    };

    void registerTools();
    return () => lifecycle.abort();
  }, []);

  const filteredReagents = useMemo(() => {
    return reagents.filter((reagent) =>
      reagentMatches(reagent, search, activeCategory),
    );
  }, [activeCategory, reagents, search]);

  const lowStockCount = reagents.filter(
    (reagent) => reagent.status === '偏低',
  ).length;
  const expiringCount = reagents.filter(
    (reagent) => reagent.status === '即将过期',
  ).length;
  const pendingInfoCount = reagents.filter(
    (reagent) => reagent.expiry === '未录入' || reagent.supplier === '—',
  ).length;

  async function handleInviteSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inviteCode.trim()) return;

    setIsAuthenticating(true);
    setInviteError('');
    try {
      const response = await fetch('/api/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inviteCode }),
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || '邀请码验证失败');
      setInviteCode('');
      setInviteError('');
      setAccessState('authorized');
    } catch (error) {
      setInviteError(
        error instanceof Error ? error.message : '邀请码验证失败，请稍后重试。',
      );
    } finally {
      setIsAuthenticating(false);
    }
  }

  function updateDraft(key: keyof typeof emptyDraft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function openAddDialog() {
    setSelected(null);
    setEditingId(null);
    setDraft(emptyDraft);
    setIsAddOpen(true);
  }

  function openEditDialog(reagent: Reagent) {
    setSelected(null);
    setEditingId(reagent.id);
    setDraft({
      name: reagent.name,
      alias: reagent.alias === '—' ? '' : reagent.alias,
      cas: reagent.cas === '—' ? '' : reagent.cas,
      category: reagent.category,
      location: reagent.location === '待分配' ? '' : reagent.location,
      storageTemp: reagent.storageTemp,
      stock: String(reagent.stock),
      unit: reagent.unit,
      supplier: reagent.supplier === '待补充' || reagent.supplier === '—' ? '' : reagent.supplier,
      expiry:
        reagent.expiry === '待录入' || reagent.expiry === '未录入'
          ? ''
          : reagent.expiry,
      notes: reagent.notes === '暂无备注。' ? '' : reagent.notes,
    });
    setIsAddOpen(true);
  }

  async function handleSave(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.name.trim()) return;

    setIsSaving(true);
    try {
      const saved = await saveReagentRequest(
        editingId === null ? '/api/reagents' : `/api/reagents/${editingId}`,
        editingId === null ? 'POST' : 'PATCH',
        draft,
      );
      setReagents((current) =>
        editingId === null
          ? [saved, ...current]
          : current.map((reagent) => (reagent.id === saved.id ? saved : reagent)),
      );
      setDraft(emptyDraft);
      setEditingId(null);
      setIsAddOpen(false);
      setSyncState('ready');
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '保存失败，请稍后重试。');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(reagent: Reagent) {
    if (!window.confirm(`确定删除“${reagent.name}”吗？删除后所有组员都将看不到这条记录。`)) {
      return;
    }

    try {
      await deleteReagentRequest(reagent.id);
      setReagents((current) => current.filter((item) => item.id !== reagent.id));
      setSelected(null);
      setSyncState('ready');
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '删除失败，请稍后重试。');
    }
  }

  if (accessState !== 'authorized') {
    return (
      <InviteGate
        status={accessState}
        code={inviteCode}
        error={inviteError}
        submitting={isAuthenticating}
        onCodeChange={(value) => {
          setInviteCode(value);
          if (inviteError) setInviteError('');
        }}
        onSubmit={handleInviteSubmit}
      />
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <FlaskConical size={20} strokeWidth={2.4} />
          </div>
          <div>
            <p className="brand-name">LabStock</p>
            <p className="brand-subtitle">课题组试剂库</p>
          </div>
        </div>
        <div className="topbar-actions">
          <div className="workspace-access-badge" title="整个工作区成员可共同使用">
            <UsersRound size={15} />
            <span>工作区共享</span>
            <span className={`sync-dot sync-${syncState}`} aria-hidden="true" />
          </div>
          <Button variant="ghost" size="icon" aria-label="帮助">
            <CircleHelp size={18} />
          </Button>
          <div className="avatar" aria-label="当前用户">
            W
          </div>
        </div>
      </header>

      <div className="app-layout">
        <aside className="sidebar" aria-label="主导航">
          <div className="sidebar-section-label">WORKSPACE</div>
          <nav className="sidebar-nav">
            <a className="sidebar-link active" href="#inventory">
              <Grid2X2 size={17} />
              <span>试剂库</span>
              <span className="nav-count">{reagents.length}</span>
            </a>
            <a className="sidebar-link" href="#alerts">
              <AlertTriangle size={17} />
              <span>库存提醒</span>
              <span className="nav-count alert-count">{lowStockCount}</span>
            </a>
            <a className="sidebar-link" href="#history">
              <History size={17} />
              <span>操作记录</span>
            </a>
          </nav>

          <div className="sidebar-section-label second-label">TOOLS</div>
          <nav className="sidebar-nav">
            <a className="sidebar-link" href="#categories">
              <Layers3 size={17} />
              <span>分类管理</span>
            </a>
            <a className="sidebar-link" href="#settings">
              <Settings2 size={17} />
              <span>设置</span>
            </a>
          </nav>

          <div className="sidebar-footer-card">
            <div className="footer-card-icon">
              <PackageCheck size={18} />
            </div>
            <div>
              <p className="footer-card-title">本周盘点</p>
              <p className="footer-card-copy">还有 {pendingInfoCount} 项待补信息</p>
            </div>
            <ChevronRight size={16} className="footer-card-arrow" />
          </div>
        </aside>

        <main className="content" id="inventory">
          <div className="content-heading">
            <div>
              <p className="eyebrow">LAB INVENTORY / 2026.09</p>
              <h1>今天要找什么试剂？</h1>
              <p className="heading-copy">
                快速查看库存、定位存放位置，减少在实验室里反复寻找的时间。
              </p>
            </div>
            <Button className="add-button" onClick={openAddDialog}>
              <Plus size={17} />
              新增试剂
            </Button>
          </div>

          <section className="stats-grid" aria-label="库存概览">
            <div className="stat-card stat-card-main">
              <div className="stat-icon stat-icon-blue">
                <Beaker size={18} />
              </div>
              <div>
                <p className="stat-label">试剂总数</p>
                <p className="stat-value">
                  {reagents.length}<span> 项</span>
                </p>
              </div>
              <span className="stat-trend">来源：冰箱清单</span>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-amber">
                <AlertTriangle size={18} />
              </div>
              <div>
                <p className="stat-label">库存偏低</p>
                <p className="stat-value">
                  {lowStockCount}<span> 项</span>
                </p>
              </div>
              <span className="stat-note">需补货</span>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-rose">
                <Clock3 size={18} />
              </div>
              <div>
                <p className="stat-label">临近有效期</p>
                <p className="stat-value">
                  {expiringCount}<span> 项</span>
                </p>
              </div>
              <span className="stat-note">30 天内</span>
            </div>
          </section>

          <section className="inventory-section" aria-labelledby="inventory-title">
            <div className="section-heading-row">
              <div>
                <h2 id="inventory-title">全部试剂</h2>
                <p>{filteredReagents.length} 项结果 · 按位置与保存条件查看</p>
              </div>
              <Button variant="outline" className="filter-button">
                <SlidersHorizontal size={16} />
                筛选
              </Button>
            </div>

            <div className="search-panel">
              <div className="search-input-wrap">
                <Search size={19} aria-hidden="true" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="搜索名称、CAS号、位置或供应商..."
                  aria-label="搜索试剂"
                />
                {search && (
                  <button
                    className="clear-search"
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="清除搜索"
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="filter-chips" aria-label="试剂分类">
                {categoryFilters.map((category) => (
                  <button
                    key={category}
                    className={`filter-chip ${activeCategory === category ? 'selected' : ''}`}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            {filteredReagents.length > 0 ? (
              <div className="reagent-grid" aria-live="polite">
                {filteredReagents.map((reagent) => {
                  const status = statusStyle[reagent.status];
                  const StatusIcon = status.icon;
                  return (
                    <button
                      className="reagent-card"
                      type="button"
                      key={reagent.id}
                      onClick={() => setSelected(reagent)}
                    >
                      <div
                        className={`card-accent ${getCategoryTone(reagent.category)}`}
                      />
                      <div className="reagent-card-topline">
                        <span
                          className={`category-label ${getCategoryTone(reagent.category)}`}
                        >
                          <Tag size={12} />
                          {reagent.category}
                        </span>
                        <span className={`status-chip ${status.chip}`}>
                          <StatusIcon size={13} />
                          {reagent.status}
                        </span>
                      </div>
                      <div className="reagent-name-row">
                        <div>
                          <h3>{reagent.name}</h3>
                          <p>{reagent.alias}</p>
                        </div>
                        <ChevronRight size={18} className="card-chevron" />
                      </div>
                      <div className="reagent-location-strip">
                        <div className="location-label">
                          <MapPin size={15} />
                          <span>冰箱格位</span>
                        </div>
                        <strong>{reagent.location}</strong>
                        <span className="location-temp">
                          <Thermometer size={14} />
                          {reagent.storageTemp}
                        </span>
                      </div>
                      <div className="reagent-meta-row">
                        <span>
                          <span className="meta-key">CAS</span> {reagent.cas}
                        </span>
                      </div>
                      <div className="stock-row">
                        <div className="stock-label">
                          <span>当前库存</span>
                          <strong>
                            {formatNumber(reagent.stock)} {reagent.unit}
                          </strong>
                        </div>
                        <div className="stock-track" aria-hidden="true">
                          <span
                            className={`stock-fill ${status.bar}`}
                            style={{ width: `${getStockPercent(reagent)}%` }}
                          />
                        </div>
                        <div className="stock-footer">
                          <span>{getStockCaption(reagent)}</span>
                          <span>{reagent.updated}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <Search size={23} />
                <h3>没有找到匹配的试剂</h3>
                <p>试试名称、CAS 号或存放位置。</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch('');
                    setActiveCategory('全部');
                  }}
                >
                  清除筛选
                </Button>
              </div>
            )}
          </section>
        </main>
      </div>

      <nav className="mobile-nav" aria-label="移动端导航">
        <a className="mobile-nav-link active" href="#inventory">
          <Grid2X2 size={18} />
          <span>试剂库</span>
        </a>
        <a className="mobile-nav-link" href="#alerts">
          <AlertTriangle size={18} />
          <span>提醒</span>
        </a>
        <button
          className="mobile-add"
          type="button"
          onClick={openAddDialog}
          aria-label="新增试剂"
        >
          <Plus size={23} />
        </button>
        <a className="mobile-nav-link" href="#history">
          <History size={18} />
          <span>记录</span>
        </a>
        <a className="mobile-nav-link" href="#settings">
          <UserRound size={18} />
          <span>我的</span>
        </a>
      </nav>

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="detail-dialog">
          {selected && (
            <>
              <DialogHeader>
                <div className={`detail-category ${getCategoryTone(selected.category)}`}>
                  <Tag size={13} /> {selected.category}
                </div>
                <DialogTitle>{selected.name}</DialogTitle>
                <DialogDescription>
                  {selected.alias} · CAS {selected.cas}
                </DialogDescription>
              </DialogHeader>
              <div className="detail-status-line">
                <span className={`status-chip ${statusStyle[selected.status].chip}`}>
                  {(() => {
                    const Icon = statusStyle[selected.status].icon;
                    return <Icon size={14} />;
                  })()}
                  {selected.status}
                </span>
                <span className="detail-updated">更新于 {selected.updated}</span>
              </div>
              <div className="detail-grid">
                <div className="detail-item">
                  <MapPin size={16} />
                  <span>
                    存放位置<strong>{selected.location}</strong>
                  </span>
                </div>
                <div className="detail-item">
                  <PackageCheck size={16} />
                  <span>
                    当前库存<strong>{formatNumber(selected.stock)} {selected.unit}</strong>
                  </span>
                </div>
                <div className="detail-item">
                  <Thermometer size={16} />
                  <span>
                    保存温度<strong>{selected.storageTemp}</strong>
                  </span>
                </div>
                <div className="detail-item">
                  <Clock3 size={16} />
                  <span>
                    有效期<strong>{selected.expiry}</strong>
                  </span>
                </div>
                <div className="detail-item">
                  <Beaker size={16} />
                  <span>
                    供应商<strong>{selected.supplier}</strong>
                  </span>
                </div>
              </div>
              <div className="detail-note">
                <p>备注</p>
                <span>{selected.notes}</span>
              </div>
              <DialogFooter className="detail-footer">
                <Button variant="outline" onClick={() => setSelected(null)}>
                  关闭
                </Button>
                <Button onClick={() => openEditDialog(selected)}>
                  <Pencil size={15} />
                  编辑信息
                </Button>
                <Button
                  variant="outline"
                  className="delete-button"
                  onClick={() => handleDelete(selected)}
                >
                  <Trash2 size={15} />
                  删除
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isAddOpen}
        onOpenChange={(open) => {
          setIsAddOpen(open);
          if (!open) setEditingId(null);
        }}
      >
        <DialogContent className="add-dialog">
          <DialogHeader>
            <DialogTitle>{editingId === null ? '新增试剂' : '编辑试剂信息'}</DialogTitle>
            <DialogDescription>
              {editingId === null
                ? '先录入关键字段，后续可以继续补充批号和安全信息。'
                : '修改后会立即同步给整个工作区的成员。'}
            </DialogDescription>
          </DialogHeader>
          <form className="add-form" onSubmit={handleSave}>
            <div className="form-field full-field">
              <label htmlFor="reagent-name">试剂名称 *</label>
              <Input
                id="reagent-name"
                value={draft.name}
                onChange={(event) => updateDraft('name', event.target.value)}
                placeholder="例如：Tris-HCl 缓冲液"
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="reagent-alias">规格 / 别名</label>
              <Input
                id="reagent-alias"
                value={draft.alias}
                onChange={(event) => updateDraft('alias', event.target.value)}
                placeholder="例如：1 M, pH 8.0"
              />
            </div>
            <div className="form-field">
              <label htmlFor="reagent-cas">CAS 号</label>
              <Input
                id="reagent-cas"
                value={draft.cas}
                onChange={(event) => updateDraft('cas', event.target.value)}
                placeholder="例如：1185-53-1"
              />
            </div>
            <div className="form-field">
              <label htmlFor="reagent-category">分类</label>
              <select
                id="reagent-category"
                value={draft.category}
                onChange={(event) => updateDraft('category', event.target.value)}
              >
                {categoryFilters
                  .filter((category) => category !== '全部')
                  .map((category) => (
                    <option key={category}>{category}</option>
                  ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="reagent-location">存放位置</label>
              <Input
                id="reagent-location"
                value={draft.location}
                onChange={(event) => updateDraft('location', event.target.value)}
                placeholder="例如：A1"
              />
            </div>
            <div className="form-field">
              <label htmlFor="reagent-storage-temp">保存温度</label>
              <select
                id="reagent-storage-temp"
                value={draft.storageTemp}
                onChange={(event) => updateDraft('storageTemp', event.target.value)}
              >
                <option>待确认</option>
                <option>4℃</option>
                <option>-20℃</option>
                <option>常温</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="reagent-stock">当前库存</label>
              <Input
                id="reagent-stock"
                type="number"
                min="0"
                value={draft.stock}
                onChange={(event) => updateDraft('stock', event.target.value)}
                placeholder="0"
              />
            </div>
            <div className="form-field">
              <label htmlFor="reagent-unit">单位</label>
              <select
                id="reagent-unit"
                value={draft.unit}
                onChange={(event) => updateDraft('unit', event.target.value)}
              >
                <option>瓶</option>
                <option>盒</option>
                <option>mL</option>
                <option>g</option>
                <option>kg</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="reagent-supplier">供应商</label>
              <Input
                id="reagent-supplier"
                value={draft.supplier}
                onChange={(event) => updateDraft('supplier', event.target.value)}
                placeholder="例如：Sigma-Aldrich"
              />
            </div>
            <div className="form-field">
              <label htmlFor="reagent-expiry">有效期</label>
              <Input
                id="reagent-expiry"
                type="date"
                value={draft.expiry}
                onChange={(event) => updateDraft('expiry', event.target.value)}
              />
            </div>
            <div className="form-field full-field">
              <label htmlFor="reagent-notes">备注</label>
              <textarea
                id="reagent-notes"
                value={draft.notes}
                onChange={(event) => updateDraft('notes', event.target.value)}
                placeholder="保存条件、用途或注意事项..."
                rows={3}
              />
            </div>
            <DialogFooter className="add-form-footer">
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <RefreshCw size={16} className="spin-icon" /> : <Plus size={16} />}
                {isSaving
                  ? '正在同步...'
                  : editingId === null
                    ? '保存并加入试剂库'
                    : '保存修改'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Beaker,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  ClipboardList,
  Database,
  FlaskConical,
  Grid2X2,
  History,
  KeyRound,
  Layers3,
  LogOut,
  MapPin,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
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
  deletedAt?: string | null;
  deletedBy?: string | null;
};

type AppView =
  | 'inventory'
  | 'alerts'
  | 'history'
  | 'categories'
  | 'settings'
  | 'trash';

type Activity = {
  id: number;
  action: string;
  reagentId: number | null;
  reagentName: string;
  userId: string;
  userEmail: string;
  summary: string;
  createdAt: string;
};

type ActivityState = 'idle' | 'loading' | 'ready' | 'offline';
type TrashState = 'idle' | 'loading' | 'ready' | 'offline';

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

const API_BASE_URL =
  typeof window !== 'undefined' &&
  window.location.hostname.endsWith('.github.io')
    ? 'https://labstock-reagent-inventory.2442148683.workers.dev'
    : '';

function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

async function fetchWithRetry(path: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(apiUrl(path), {
        cache: 'no-store',
        credentials: 'include',
      });
      if (response.ok || response.status === 401) return response;
      lastError = new Error(`请求失败（${response.status}）`);
    } catch (error) {
      lastError = error;
    }
    if (attempt === 0) {
      await new Promise((resolve) => window.setTimeout(resolve, 450));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('网络连接失败');
}

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
  const response = await fetch(apiUrl(path), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toWritePayload(input)),
    cache: 'no-store',
    credentials: 'include',
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
  const response = await fetch(apiUrl(`/api/reagents/${id}`), {
    method: 'DELETE',
    cache: 'no-store',
    credentials: 'include',
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  if (!response.ok) throw new Error(payload.error || '删除试剂失败');
}

async function fetchTrashRequest() {
  const response = await fetchWithRetry('/api/trash?limit=200');
  const payload = (await response.json().catch(() => ({}))) as {
    reagents?: Reagent[];
    error?: string;
  };
  if (!response.ok || !Array.isArray(payload.reagents)) {
    throw new Error(payload.error || '回收站暂时不可用');
  }
  return payload.reagents;
}

async function restoreReagentRequest(id: number) {
  const response = await fetch(apiUrl(`/api/reagents/${id}/restore`), {
    method: 'POST',
    cache: 'no-store',
    credentials: 'include',
  });
  const payload = (await response.json().catch(() => ({}))) as {
    reagent?: Reagent;
    error?: string;
  };
  if (!response.ok || !payload.reagent) {
    throw new Error(payload.error || '恢复试剂失败');
  }
  return payload.reagent;
}

async function permanentlyDeleteReagentRequest(id: number) {
  const response = await fetch(apiUrl(`/api/trash/${id}`), {
    method: 'DELETE',
    cache: 'no-store',
    credentials: 'include',
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  if (!response.ok) throw new Error(payload.error || '彻底删除失败');
}

async function fetchActivitiesRequest() {
  const response = await fetchWithRetry('/api/activity?limit=100');
  const payload = (await response.json().catch(() => ({}))) as {
    activities?: Activity[];
    error?: string;
  };
  if (!response.ok || !Array.isArray(payload.activities)) {
    throw new Error(payload.error || '操作记录暂时不可用');
  }
  return payload.activities;
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
            <Button
              type="submit"
              className="invite-submit"
              disabled={submitting}
            >
              {submitting ? (
                <RefreshCw size={16} className="spin-icon" />
              ) : (
                <KeyRound size={16} />
              )}
              {submitting ? '验证中…' : '进入试剂库'}
            </Button>
          </form>
        )}
        <p className="invite-gate-footnote">
          仅限课题组成员使用 · 数据实时共享
        </p>
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

function getViewFromHash(hash: string): AppView {
  const value = hash.replace(/^#/, '') as AppView;
  return [
    'inventory',
    'alerts',
    'history',
    'categories',
    'settings',
    'trash',
  ].includes(value)
    ? value
    : 'inventory';
}

function formatActivityTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function WorkspaceViewHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="content-heading workspace-view-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="heading-copy">{description}</p>
      </div>
      {action}
    </div>
  );
}

function AlertReagentRow({
  reagent,
  onSelect,
}: {
  reagent: Reagent;
  onSelect: (reagent: Reagent) => void;
}) {
  const status = statusStyle[reagent.status];
  const StatusIcon = status.icon;
  return (
    <button
      className="alert-reagent-row"
      type="button"
      onClick={() => onSelect(reagent)}
    >
      <span className={`alert-row-icon ${status.chip}`}>
        <StatusIcon size={16} />
      </span>
      <span className="alert-row-main">
        <strong>{reagent.name}</strong>
        <span>
          {reagent.status} · 当前 {formatNumber(reagent.stock)} {reagent.unit}
        </span>
      </span>
      <span className="alert-row-location">
        <MapPin size={14} />
        {reagent.location}
      </span>
      <ChevronRight size={16} className="alert-row-arrow" />
    </button>
  );
}

function AlertsView({
  reagents,
  onSelect,
  onViewInventory,
  onAdd,
}: {
  reagents: Reagent[];
  onSelect: (reagent: Reagent) => void;
  onViewInventory: () => void;
  onAdd: () => void;
}) {
  const lowStockReagents = reagents.filter(
    (reagent) => reagent.status === '偏低',
  );
  const expiringReagents = reagents.filter(
    (reagent) => reagent.status === '即将过期',
  );
  const pendingInfo = reagents.filter(
    (reagent) => reagent.expiry === '未录入' || reagent.supplier === '—',
  );

  return (
    <div className="workspace-view">
      <WorkspaceViewHeader
        eyebrow="WORKSPACE / ALERTS"
        title="库存提醒"
        description="集中查看需要补货、临近有效期或资料尚未补全的试剂。点击任意记录可直接打开详情。"
        action={
          <Button className="view-header-button" onClick={onAdd}>
            <Plus size={17} />
            新增试剂
          </Button>
        }
      />

      <div className="view-stat-grid">
        <div className="view-stat-card view-stat-amber">
          <div className="view-stat-icon">
            <AlertTriangle size={18} />
          </div>
          <div>
            <span>库存偏低</span>
            <strong>{lowStockReagents.length}</strong>
            <small>需要补货</small>
          </div>
        </div>
        <div className="view-stat-card view-stat-rose">
          <div className="view-stat-icon">
            <Clock3 size={18} />
          </div>
          <div>
            <span>临近有效期</span>
            <strong>{expiringReagents.length}</strong>
            <small>30 天内到期</small>
          </div>
        </div>
        <div className="view-stat-card view-stat-blue">
          <div className="view-stat-icon">
            <ClipboardList size={18} />
          </div>
          <div>
            <span>待补充资料</span>
            <strong>{pendingInfo.length}</strong>
            <small>有效期或供应商</small>
          </div>
        </div>
      </div>

      <div className="workspace-columns">
        <section className="view-card alert-list-card">
          <div className="view-card-heading">
            <div>
              <h2>需要处理</h2>
              <p>库存和有效期提醒会根据当前记录自动更新。</p>
            </div>
            <AlertTriangle size={20} className="view-card-heading-icon" />
          </div>
          {lowStockReagents.length === 0 && expiringReagents.length === 0 ? (
            <div className="view-empty compact-empty">
              <CheckCircle2 size={24} />
              <strong>目前没有需要处理的提醒</strong>
              <span>当前试剂库存充足，且没有录入 30 天内到期的试剂。</span>
            </div>
          ) : (
            <div className="alert-list">
              {[...lowStockReagents, ...expiringReagents].map((reagent) => (
                <AlertReagentRow
                  key={`${reagent.id}-${reagent.status}`}
                  reagent={reagent}
                  onSelect={onSelect}
                />
              ))}
            </div>
          )}
        </section>

        <section className="view-card alert-guide-card">
          <div className="view-card-heading">
            <div>
              <h2>快速处理</h2>
              <p>把缺失信息补齐，方便组员定位和使用。</p>
            </div>
            <PackageCheck size={20} className="view-card-heading-icon" />
          </div>
          <div className="guide-step-list">
            <div className="guide-step">
              <span>01</span>
              <div>
                <strong>补充位置</strong>
                <p>在试剂详情中确认冰箱格位。</p>
              </div>
            </div>
            <div className="guide-step">
              <span>02</span>
              <div>
                <strong>更新库存</strong>
                <p>试剂使用后及时修改当前数量。</p>
              </div>
            </div>
            <div className="guide-step">
              <span>03</span>
              <div>
                <strong>查看全部</strong>
                <p>按名称、CAS 或位置检索记录。</p>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            className="wide-outline-button"
            onClick={onViewInventory}
          >
            <Search size={15} />
            去试剂库查看
          </Button>
        </section>
      </div>

      <section className="view-card completion-card">
        <div className="completion-copy">
          <div className="view-card-heading-icon completion-icon">
            <ClipboardList size={19} />
          </div>
          <div>
            <h2>本周盘点</h2>
            <p>
              共有 {pendingInfo.length}{' '}
              条记录仍缺少有效期或供应商信息，可从试剂库逐条补充。
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={onViewInventory}>
          打开试剂库
        </Button>
      </section>
    </div>
  );
}

function HistoryView({
  activities,
  state,
  onRefresh,
  onAdd,
}: {
  activities: Activity[];
  state: ActivityState;
  onRefresh: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="workspace-view">
      <WorkspaceViewHeader
        eyebrow="WORKSPACE / ACTIVITY"
        title="操作记录"
        description="记录新增、编辑和删除操作，方便课题组成员追踪库存变化。"
        action={
          <div className="view-header-actions">
            <Button
              variant="outline"
              onClick={onRefresh}
              disabled={state === 'loading'}
            >
              <RefreshCw
                size={15}
                className={state === 'loading' ? 'spin-icon' : ''}
              />
              刷新记录
            </Button>
            <Button className="view-header-button" onClick={onAdd}>
              <Plus size={17} />
              新增试剂
            </Button>
          </div>
        }
      />

      <section className="view-card activity-card">
        <div className="view-card-heading">
          <div>
            <h2>最近活动</h2>
            <p>显示最近 100 条共享数据库操作。</p>
          </div>
          <History size={20} className="view-card-heading-icon" />
        </div>
        {state === 'loading' && activities.length === 0 ? (
          <div className="view-loading">
            <RefreshCw size={20} className="spin-icon" />
            正在加载操作记录…
          </div>
        ) : activities.length === 0 ? (
          <div className="view-empty">
            <History size={26} />
            <strong>暂时还没有操作记录</strong>
            <span>新增、编辑或删除试剂后，记录会自动出现在这里。</span>
          </div>
        ) : (
          <div className="activity-list">
            {activities.map((activity) => {
              const isDelete = ['删除', '移入回收站', '彻底删除'].includes(
                activity.action,
              );
              const isAdd =
                activity.action === '新增' || activity.action === '导入';
              return (
                <div className="activity-row" key={activity.id}>
                  <div
                    className={`activity-icon ${isDelete ? 'activity-delete' : isAdd ? 'activity-add' : 'activity-edit'}`}
                  >
                    {isDelete ? (
                      <Trash2 size={16} />
                    ) : isAdd ? (
                      <Plus size={17} />
                    ) : (
                      <Pencil size={16} />
                    )}
                  </div>
                  <div className="activity-main">
                    <strong>
                      {activity.action} · {activity.reagentName}
                    </strong>
                    <span>{activity.summary}</span>
                  </div>
                  <div className="activity-meta">
                    <span>
                      {activity.userEmail ||
                        (activity.userId === 'import'
                          ? '系统导入'
                          : '组内成员')}
                    </span>
                    <time>{formatActivityTime(activity.createdAt)}</time>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function CategoriesView({
  reagents,
  onViewCategory,
  onAdd,
}: {
  reagents: Reagent[];
  onViewCategory: (category: string) => void;
  onAdd: () => void;
}) {
  const categories = categoryFilters.filter((category) => category !== '全部');
  return (
    <div className="workspace-view">
      <WorkspaceViewHeader
        eyebrow="TOOLS / CATEGORIES"
        title="分类管理"
        description="按用途查看试剂分布。当前分类为课题组预设分类，新增试剂时可以直接选择。"
        action={
          <Button className="view-header-button" onClick={onAdd}>
            <Plus size={17} />
            新增试剂
          </Button>
        }
      />
      <div className="category-overview-bar">
        <div>
          <span>已启用分类</span>
          <strong>{categories.length}</strong>
        </div>
        <div>
          <span>已归类试剂</span>
          <strong>{reagents.length}</strong>
        </div>
        <div>
          <span>占用位置</span>
          <strong>
            {new Set(reagents.map((reagent) => reagent.location)).size}
          </strong>
        </div>
      </div>
      <div className="category-manage-grid">
        {categories.map((category) => {
          const items = reagents.filter(
            (reagent) => reagent.category === category,
          );
          const temperatures = ['4℃', '-20℃', '常温']
            .map((temperature) => ({
              temperature,
              count: items.filter((item) => item.storageTemp === temperature)
                .length,
            }))
            .filter((item) => item.count > 0);
          return (
            <section className="category-manage-card" key={category}>
              <div className="category-manage-topline">
                <span className={`category-label ${getCategoryTone(category)}`}>
                  <Tag size={12} />
                  {category}
                </span>
                <strong>
                  {items.length}
                  <small> 项</small>
                </strong>
              </div>
              <p>
                {items.length ? '已收录在共享试剂库中' : '暂时没有该分类试剂'}
              </p>
              <div className="category-temperature-list">
                {temperatures.length ? (
                  temperatures.map((item) => (
                    <span key={item.temperature}>
                      {item.temperature} <b>{item.count}</b>
                    </span>
                  ))
                ) : (
                  <span>暂无温度记录</span>
                )}
              </div>
              <Button
                variant="outline"
                className="category-view-button"
                onClick={() => onViewCategory(category)}
                disabled={items.length === 0}
              >
                查看此分类 <ChevronRight size={14} />
              </Button>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function SettingsView({
  syncState,
  reagentCount,
  pendingInfoCount,
  onRefresh,
  onSignOut,
}: {
  syncState: 'loading' | 'ready' | 'offline';
  reagentCount: number;
  pendingInfoCount: number;
  onRefresh: () => void;
  onSignOut: () => void;
}) {
  const syncLabel =
    syncState === 'ready'
      ? '已连接并实时同步'
      : syncState === 'loading'
        ? '正在连接数据库'
        : '连接异常';
  return (
    <div className="workspace-view">
      <WorkspaceViewHeader
        eyebrow="TOOLS / SETTINGS"
        title="设置"
        description="查看当前工作区连接状态和数据来源。配置变化会影响所有使用这个网站的成员。"
      />
      <div className="settings-grid">
        <section className="view-card settings-card">
          <div className="view-card-heading">
            <div>
              <h2>工作区信息</h2>
              <p>当前共享试剂库的基础信息。</p>
            </div>
            <UsersRound size={20} className="view-card-heading-icon" />
          </div>
          <div className="settings-row">
            <span>工作区名称</span>
            <strong>tianlab</strong>
          </div>
          <div className="settings-row">
            <span>访问方式</span>
            <strong>邀请码访问</strong>
          </div>
          <div className="settings-row">
            <span>共享成员权限</span>
            <strong>可查看、新增、编辑、删除</strong>
          </div>
          <div className="settings-row">
            <span>本设备状态</span>
            <strong className="settings-status">
              <span className="settings-status-dot" />
              已授权
            </strong>
          </div>
        </section>
        <section className="view-card settings-card">
          <div className="view-card-heading">
            <div>
              <h2>数据连接</h2>
              <p>线上数据库与当前页面的状态。</p>
            </div>
            <Database size={20} className="view-card-heading-icon" />
          </div>
          <div className="settings-row">
            <span>数据库状态</span>
            <strong className={`settings-status settings-${syncState}`}>
              <span className="settings-status-dot" />
              {syncLabel}
            </strong>
          </div>
          <div className="settings-row">
            <span>当前试剂</span>
            <strong>{reagentCount} 条</strong>
          </div>
          <div className="settings-row">
            <span>数据来源</span>
            <strong>冰箱清单</strong>
          </div>
          <div className="settings-row">
            <span>待补信息</span>
            <strong>{pendingInfoCount} 条</strong>
          </div>
          <Button
            variant="outline"
            className="wide-outline-button"
            onClick={onRefresh}
          >
            <RefreshCw size={15} />
            重新同步数据
          </Button>
        </section>
      </div>
      <section className="view-card settings-danger-card">
        <div>
          <h2>本设备访问</h2>
          <p>退出后需要再次输入课题组邀请码才能进入。</p>
        </div>
        <Button
          variant="outline"
          className="sign-out-button"
          onClick={onSignOut}
        >
          <LogOut size={15} />
          退出当前设备
        </Button>
      </section>
    </div>
  );
}

function TrashView({
  reagents,
  state,
  actionId,
  onRefresh,
  onRestore,
  onPermanentDelete,
  onAdd,
}: {
  reagents: Reagent[];
  state: TrashState;
  actionId: number | null;
  onRefresh: () => void;
  onRestore: (reagent: Reagent) => void;
  onPermanentDelete: (reagent: Reagent) => void;
  onAdd: () => void;
}) {
  return (
    <div className="workspace-view">
      <WorkspaceViewHeader
        eyebrow="TOOLS / RECYCLE BIN"
        title="回收站"
        description="误删的试剂会先移到这里，不会立即从数据库消失。恢复后会重新出现在共享试剂库。"
        action={
          <div className="view-header-actions">
            <Button
              variant="outline"
              onClick={onRefresh}
              disabled={state === 'loading'}
            >
              <RefreshCw
                size={15}
                className={state === 'loading' ? 'spin-icon' : ''}
              />
              刷新回收站
            </Button>
            <Button className="view-header-button" onClick={onAdd}>
              <Plus size={17} />
              新增试剂
            </Button>
          </div>
        }
      />

      <section className="view-card trash-card">
        <div className="view-card-heading">
          <div>
            <h2>已移入回收站</h2>
            <p>默认保留记录，只有点击“永久删除”才会真正从数据库移除。</p>
          </div>
          <Trash2 size={20} className="view-card-heading-icon" />
        </div>
        {state === 'loading' && reagents.length === 0 ? (
          <div className="view-loading">
            <RefreshCw size={20} className="spin-icon" />
            正在加载回收站…
          </div>
        ) : state === 'offline' && reagents.length === 0 ? (
          <div className="view-empty">
            <RefreshCw size={26} />
            <strong>回收站暂时无法连接</strong>
            <span>请检查网络后点击“刷新回收站”。</span>
            <Button variant="outline" onClick={onRefresh}>
              重新连接
            </Button>
          </div>
        ) : reagents.length === 0 ? (
          <div className="view-empty">
            <CheckCircle2 size={26} />
            <strong>回收站是空的</strong>
            <span>删除试剂时会先移动到这里，方便之后恢复。</span>
          </div>
        ) : (
          <div className="trash-list">
            {reagents.map((reagent) => {
              const isBusy = actionId === reagent.id;
              return (
                <div className="trash-row" key={reagent.id}>
                  <div className="trash-row-icon">
                    <Trash2 size={17} />
                  </div>
                  <div className="trash-row-main">
                    <strong>{reagent.name}</strong>
                    <span>
                      {reagent.category} · 原位置 {reagent.location} ·{' '}
                      {reagent.storageTemp}
                    </span>
                  </div>
                  <div className="trash-row-meta">
                    <span>
                      删除于{' '}
                      {reagent.deletedAt
                        ? formatActivityTime(reagent.deletedAt)
                        : '时间未知'}
                    </span>
                    <span>
                      {reagent.deletedBy ? '组内成员操作' : '系统操作'}
                    </span>
                  </div>
                  <div className="trash-row-actions">
                    <Button
                      variant="outline"
                      onClick={() => onRestore(reagent)}
                      disabled={isBusy}
                    >
                      {isBusy ? (
                        <RefreshCw size={14} className="spin-icon" />
                      ) : (
                        <RotateCcw size={14} />
                      )}
                      恢复
                    </Button>
                    <Button
                      variant="outline"
                      className="permanent-delete-button"
                      onClick={() => onPermanentDelete(reagent)}
                      disabled={isBusy}
                    >
                      <Trash2 size={14} />
                      永久删除
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
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
  const [accessState, setAccessState] = useState<
    'loading' | 'locked' | 'authorized'
  >('loading');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [syncState, setSyncState] = useState<'loading' | 'ready' | 'offline'>(
    'loading',
  );
  const [activeView, setActiveView] = useState<AppView>('inventory');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterTemperature, setFilterTemperature] = useState('全部');
  const [filterStatus, setFilterStatus] = useState('全部');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activityState, setActivityState] = useState<ActivityState>('idle');
  const [trashReagents, setTrashReagents] = useState<Reagent[]>([]);
  const [trashState, setTrashState] = useState<TrashState>('idle');
  const [trashActionId, setTrashActionId] = useState<number | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const reagentsRef = useRef(reagents);

  useEffect(() => {
    const syncViewFromHash = () => {
      setActiveView(getViewFromHash(window.location.hash));
    };
    syncViewFromHash();
    window.addEventListener('hashchange', syncViewFromHash);
    return () => window.removeEventListener('hashchange', syncViewFromHash);
  }, []);

  useEffect(() => {
    reagentsRef.current = reagents;
  }, [reagents]);

  useEffect(() => {
    let active = true;
    const checkInviteAccess = async () => {
      try {
        const response = await fetchWithRetry('/api/access');
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

  async function refreshSharedInventory() {
    setSyncState('loading');
    try {
      const response = await fetchWithRetry('/api/reagents');
      const payload = (await response.json().catch(() => ({}))) as {
        reagents?: Reagent[];
        error?: string;
      };
      if (response.status === 401) {
        setAccessState('locked');
        setSyncState('offline');
        return;
      }
      if (!response.ok || !Array.isArray(payload.reagents)) {
        throw new Error(payload.error || 'shared inventory unavailable');
      }
      setReagents(payload.reagents);
      setSyncState('ready');
    } catch {
      setSyncState('offline');
    }
  }

  async function refreshTrash() {
    setTrashState('loading');
    try {
      setTrashReagents(await fetchTrashRequest());
      setTrashState('ready');
    } catch {
      setTrashState('offline');
    }
  }

  useEffect(() => {
    if (accessState === 'authorized') {
      const timer = window.setTimeout(() => {
        void refreshSharedInventory();
        void refreshTrash();
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [accessState]);

  async function refreshActivityLog() {
    setActivityState('loading');
    try {
      setActivities(await fetchActivitiesRequest());
      setActivityState('ready');
    } catch {
      setActivityState('offline');
    }
  }

  useEffect(() => {
    if (accessState === 'authorized' && activeView === 'history') {
      const timer = window.setTimeout(() => void refreshActivityLog(), 0);
      return () => window.clearTimeout(timer);
    }
  }, [accessState, activeView]);

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
              const query =
                typeof values.query === 'string' ? values.query : '';
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
                reagents: matches.map(
                  ({ id, name, cas, location, stock, unit }) => ({
                    id,
                    name,
                    cas,
                    location,
                    stock,
                    unit,
                  }),
                ),
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
              required: ['name', 'location'],
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
              const newReagent = await saveReagentRequest(
                '/api/reagents',
                'POST',
                {
                  name: typeof values.name === 'string' ? values.name : '',
                  alias: typeof values.alias === 'string' ? values.alias : '',
                  cas: typeof values.cas === 'string' ? values.cas : '',
                  category,
                  location:
                    typeof values.location === 'string' ? values.location : '',
                  storageTemp:
                    typeof values.storageTemp === 'string'
                      ? values.storageTemp
                      : '待确认',
                  stock:
                    typeof values.stock === 'number'
                      ? String(values.stock)
                      : '',
                  unit: typeof values.unit === 'string' ? values.unit : '瓶',
                  supplier:
                    typeof values.supplier === 'string' ? values.supplier : '',
                  expiry:
                    typeof values.expiry === 'string' ? values.expiry : '',
                  notes: typeof values.notes === 'string' ? values.notes : '',
                },
              );
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
    return reagents.filter(
      (reagent) =>
        reagentMatches(reagent, search, activeCategory) &&
        (filterTemperature === '全部' ||
          reagent.storageTemp === filterTemperature) &&
        (filterStatus === '全部' || reagent.status === filterStatus),
    );
  }, [activeCategory, filterStatus, filterTemperature, reagents, search]);

  const lowStockCount = reagents.filter(
    (reagent) => reagent.status === '偏低',
  ).length;
  const expiringCount = reagents.filter(
    (reagent) => reagent.status === '即将过期',
  ).length;
  const pendingInfoCount = reagents.filter(
    (reagent) => reagent.expiry === '未录入' || reagent.supplier === '—',
  ).length;

  function navigateTo(view: AppView) {
    if (window.location.hash === `#${view}`) {
      setActiveView(view);
      return;
    }
    window.location.hash = view;
  }

  function viewCategory(category: string) {
    setSearch('');
    setActiveCategory(category);
    setFilterTemperature('全部');
    setFilterStatus('全部');
    setFilterOpen(false);
    navigateTo('inventory');
  }

  async function handleSignOut() {
    await fetch(apiUrl('/api/access'), {
      method: 'DELETE',
      cache: 'no-store',
      credentials: 'include',
    }).catch(() => undefined);
    setSelected(null);
    setReagents([]);
    setTrashReagents([]);
    setActiveView('inventory');
    setAccessState('locked');
    window.location.hash = 'inventory';
  }

  async function handleInviteSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inviteCode.trim()) return;

    setIsAuthenticating(true);
    setInviteError('');
    try {
      const response = await fetch(apiUrl('/api/access'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inviteCode }),
        cache: 'no-store',
        credentials: 'include',
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
      supplier:
        reagent.supplier === '待补充' || reagent.supplier === '—'
          ? ''
          : reagent.supplier,
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
    if (editingId === null && !draft.location.trim()) {
      window.alert('请填写存放位置后再保存。');
      return;
    }

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
          : current.map((reagent) =>
              reagent.id === saved.id ? saved : reagent,
            ),
      );
      setDraft(emptyDraft);
      setEditingId(null);
      setIsAddOpen(false);
      setSyncState('ready');
      void refreshActivityLog();
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : '保存失败，请稍后重试。',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(reagent: Reagent) {
    if (
      !window.confirm(`确定把“${reagent.name}”移入回收站吗？之后仍可以恢复。`)
    ) {
      return;
    }

    try {
      await deleteReagentRequest(reagent.id);
      setReagents((current) =>
        current.filter((item) => item.id !== reagent.id),
      );
      setSelected(null);
      setSyncState('ready');
      void refreshTrash();
      void refreshActivityLog();
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : '删除失败，请稍后重试。',
      );
    }
  }

  async function handleRestore(reagent: Reagent) {
    setTrashActionId(reagent.id);
    try {
      const restored = await restoreReagentRequest(reagent.id);
      setTrashReagents((current) =>
        current.filter((item) => item.id !== reagent.id),
      );
      setReagents((current) => [
        restored,
        ...current.filter((item) => item.id !== restored.id),
      ]);
      setSyncState('ready');
      void refreshActivityLog();
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : '恢复失败，请稍后重试。',
      );
      void refreshTrash();
    } finally {
      setTrashActionId(null);
    }
  }

  async function handlePermanentDelete(reagent: Reagent) {
    if (!window.confirm(`确定永久删除“${reagent.name}”吗？此操作无法恢复。`)) {
      return;
    }

    setTrashActionId(reagent.id);
    try {
      await permanentlyDeleteReagentRequest(reagent.id);
      setTrashReagents((current) =>
        current.filter((item) => item.id !== reagent.id),
      );
      void refreshActivityLog();
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : '彻底删除失败，请稍后重试。',
      );
      void refreshTrash();
    } finally {
      setTrashActionId(null);
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
            <p className="brand-subtitle">tianlab</p>
          </div>
        </div>
        <div className="topbar-actions">
          <div
            className="workspace-access-badge"
            title="整个工作区成员可共同使用"
          >
            <UsersRound size={15} />
            <span>工作区共享</span>
            <span className={`sync-dot sync-${syncState}`} aria-hidden="true" />
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="帮助"
            onClick={() => setIsHelpOpen(true)}
          >
            <CircleHelp size={18} />
          </Button>
          <div className="avatar" aria-label="当前用户">
            W
          </div>
        </div>
      </header>

      {syncState === 'offline' && (
        <div className="sync-banner" role="alert">
          <span>共享数据库暂时无法连接，当前页面可能不是最新数据。</span>
          <Button
            variant="outline"
            onClick={() => void refreshSharedInventory()}
          >
            <RefreshCw size={14} />
            重新连接
          </Button>
        </div>
      )}

      <div className="app-layout">
        <aside className="sidebar" aria-label="主导航">
          <div className="sidebar-section-label">WORKSPACE</div>
          <nav className="sidebar-nav">
            <a
              className={`sidebar-link ${activeView === 'inventory' ? 'active' : ''}`}
              href="#inventory"
            >
              <Grid2X2 size={17} />
              <span>试剂库</span>
              <span className="nav-count">{reagents.length}</span>
            </a>
            <a
              className={`sidebar-link ${activeView === 'alerts' ? 'active' : ''}`}
              href="#alerts"
            >
              <AlertTriangle size={17} />
              <span>库存提醒</span>
              <span className="nav-count alert-count">{lowStockCount}</span>
            </a>
            <a
              className={`sidebar-link ${activeView === 'history' ? 'active' : ''}`}
              href="#history"
            >
              <History size={17} />
              <span>操作记录</span>
            </a>
          </nav>

          <div className="sidebar-section-label second-label">TOOLS</div>
          <nav className="sidebar-nav">
            <a
              className={`sidebar-link ${activeView === 'categories' ? 'active' : ''}`}
              href="#categories"
            >
              <Layers3 size={17} />
              <span>分类管理</span>
            </a>
            <a
              className={`sidebar-link ${activeView === 'settings' ? 'active' : ''}`}
              href="#settings"
            >
              <Settings2 size={17} />
              <span>设置</span>
            </a>
            <a
              className={`sidebar-link ${activeView === 'trash' ? 'active' : ''}`}
              href="#trash"
            >
              <Trash2 size={17} />
              <span>回收站</span>
              <span className="nav-count trash-count">
                {trashReagents.length}
              </span>
            </a>
          </nav>

          <button
            className="sidebar-footer-card"
            type="button"
            onClick={() => navigateTo('alerts')}
          >
            <div className="footer-card-icon">
              <PackageCheck size={18} />
            </div>
            <div>
              <p className="footer-card-title">本周盘点</p>
              <p className="footer-card-copy">
                还有 {pendingInfoCount} 项待补信息
              </p>
            </div>
            <ChevronRight size={16} className="footer-card-arrow" />
          </button>
        </aside>

        <main className="content" id={activeView}>
          <div className="inventory-page" hidden={activeView !== 'inventory'}>
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
                    {reagents.length}
                    <span> 项</span>
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
                    {lowStockCount}
                    <span> 项</span>
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
                    {expiringCount}
                    <span> 项</span>
                  </p>
                </div>
                <span className="stat-note">30 天内</span>
              </div>
            </section>

            <section
              className="inventory-section"
              aria-labelledby="inventory-title"
            >
              <div className="section-heading-row">
                <div>
                  <h2 id="inventory-title">全部试剂</h2>
                  <p>{filteredReagents.length} 项结果 · 按位置与保存条件查看</p>
                </div>
                <Button
                  variant="outline"
                  className="filter-button"
                  onClick={() => setFilterOpen((current) => !current)}
                  aria-expanded={filterOpen}
                >
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
                {filterOpen && (
                  <div className="advanced-filter-panel">
                    <label>
                      <span>保存温度</span>
                      <select
                        value={filterTemperature}
                        onChange={(event) =>
                          setFilterTemperature(event.target.value)
                        }
                      >
                        <option>全部</option>
                        <option>4℃</option>
                        <option>-20℃</option>
                        <option>常温</option>
                        <option>待确认</option>
                      </select>
                    </label>
                    <label>
                      <span>库存状态</span>
                      <select
                        value={filterStatus}
                        onChange={(event) =>
                          setFilterStatus(event.target.value)
                        }
                      >
                        <option>全部</option>
                        <option>充足</option>
                        <option>偏低</option>
                        <option>即将过期</option>
                      </select>
                    </label>
                    <div className="advanced-filter-summary">
                      <span>当前筛选出 {filteredReagents.length} 项</span>
                      <button
                        type="button"
                        onClick={() => {
                          setFilterTemperature('全部');
                          setFilterStatus('全部');
                        }}
                      >
                        重置条件
                      </button>
                    </div>
                  </div>
                )}
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
                      setFilterTemperature('全部');
                      setFilterStatus('全部');
                    }}
                  >
                    清除筛选
                  </Button>
                </div>
              )}
            </section>
          </div>

          {activeView === 'alerts' && (
            <AlertsView
              reagents={reagents}
              onSelect={setSelected}
              onViewInventory={() => navigateTo('inventory')}
              onAdd={openAddDialog}
            />
          )}
          {activeView === 'history' && (
            <HistoryView
              activities={activities}
              state={activityState}
              onRefresh={() => void refreshActivityLog()}
              onAdd={openAddDialog}
            />
          )}
          {activeView === 'categories' && (
            <CategoriesView
              reagents={reagents}
              onViewCategory={viewCategory}
              onAdd={openAddDialog}
            />
          )}
          {activeView === 'settings' && (
            <SettingsView
              syncState={syncState}
              reagentCount={reagents.length}
              pendingInfoCount={pendingInfoCount}
              onRefresh={() => void refreshSharedInventory()}
              onSignOut={() => void handleSignOut()}
            />
          )}
          {activeView === 'trash' && (
            <TrashView
              reagents={trashReagents}
              state={trashState}
              actionId={trashActionId}
              onRefresh={() => void refreshTrash()}
              onRestore={(reagent) => void handleRestore(reagent)}
              onPermanentDelete={(reagent) =>
                void handlePermanentDelete(reagent)
              }
              onAdd={openAddDialog}
            />
          )}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="移动端导航">
        <a
          className={`mobile-nav-link ${activeView === 'inventory' ? 'active' : ''}`}
          href="#inventory"
        >
          <Grid2X2 size={18} />
          <span>试剂库</span>
        </a>
        <a
          className={`mobile-nav-link ${activeView === 'alerts' ? 'active' : ''}`}
          href="#alerts"
        >
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
        <a
          className={`mobile-nav-link ${activeView === 'history' ? 'active' : ''}`}
          href="#history"
        >
          <History size={18} />
          <span>记录</span>
        </a>
        <a
          className={`mobile-nav-link ${activeView === 'settings' ? 'active' : ''}`}
          href="#settings"
        >
          <UserRound size={18} />
          <span>我的</span>
        </a>
        <a
          className={`mobile-nav-link ${activeView === 'trash' ? 'active' : ''}`}
          href="#trash"
        >
          <Trash2 size={18} />
          <span>回收站</span>
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
                <div
                  className={`detail-category ${getCategoryTone(selected.category)}`}
                >
                  <Tag size={13} /> {selected.category}
                </div>
                <DialogTitle>{selected.name}</DialogTitle>
                <DialogDescription>
                  {selected.alias} · CAS {selected.cas}
                </DialogDescription>
              </DialogHeader>
              <div className="detail-status-line">
                <span
                  className={`status-chip ${statusStyle[selected.status].chip}`}
                >
                  {(() => {
                    const Icon = statusStyle[selected.status].icon;
                    return <Icon size={14} />;
                  })()}
                  {selected.status}
                </span>
                <span className="detail-updated">
                  更新于 {selected.updated}
                </span>
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
                    当前库存
                    <strong>
                      {formatNumber(selected.stock)} {selected.unit}
                    </strong>
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
            <DialogTitle>
              {editingId === null ? '新增试剂' : '编辑试剂信息'}
            </DialogTitle>
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
                onChange={(event) =>
                  updateDraft('category', event.target.value)
                }
              >
                {categoryFilters
                  .filter((category) => category !== '全部')
                  .map((category) => (
                    <option key={category}>{category}</option>
                  ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="reagent-location">
                存放位置 {editingId === null ? '*' : ''}
              </label>
              <Input
                id="reagent-location"
                value={draft.location}
                onChange={(event) =>
                  updateDraft('location', event.target.value)
                }
                placeholder={
                  editingId === null ? '例如：A1（新增时必填）' : '例如：A1'
                }
                required={editingId === null}
              />
            </div>
            <div className="form-field">
              <label htmlFor="reagent-storage-temp">保存温度</label>
              <select
                id="reagent-storage-temp"
                value={draft.storageTemp}
                onChange={(event) =>
                  updateDraft('storageTemp', event.target.value)
                }
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
                onChange={(event) =>
                  updateDraft('supplier', event.target.value)
                }
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
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddOpen(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <RefreshCw size={16} className="spin-icon" />
                ) : (
                  <Plus size={16} />
                )}
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

      <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
        <DialogContent className="help-dialog">
          <DialogHeader>
            <div className="help-dialog-icon">
              <CircleHelp size={20} />
            </div>
            <DialogTitle>使用说明</DialogTitle>
            <DialogDescription>
              tianlab 共享试剂库的常用操作。
            </DialogDescription>
          </DialogHeader>
          <div className="help-list">
            <div>
              <strong>检索试剂</strong>
              <span>在试剂库搜索框输入名称、CAS 号、位置或供应商。</span>
            </div>
            <div>
              <strong>查看和修改</strong>
              <span>点击试剂卡片查看详情，再选择“编辑信息”或“删除”。</span>
            </div>
            <div>
              <strong>新增试剂</strong>
              <span>
                点击页面右上角或各功能页的“新增试剂”，保存后所有成员都能看到。
              </span>
            </div>
            <div>
              <strong>查看变化</strong>
              <span>操作记录会保存新增、编辑和删除的时间及操作者。</span>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsHelpOpen(false)}>知道了</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

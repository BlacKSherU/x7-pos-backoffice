// Piezas comunes de las vistas Platform SaaS de companies / merchants / users (historias 1-7):
// cabecera secundaria con migas, tarjetas de métricas, tarjetas de módulo, paneles con tabla,
// formularios, estados de carga / error / vacío y la barra de navegación inferior (NavHubBar).
//
// SAAS (saas-scale.ts) es la ÚNICA escala de tamaños de estas vistas (tipografía, paddings, separaciones,
// radios, alturas de tarjetas, botones, filas de tabla e inputs, tamaños de iconos). Las vistas
// no usan tamaños sueltos: componen estas piezas o estas clases, así todas miden lo mismo.

import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { SaasCrumb } from '@/modules/platform-saas/companies/lib/saas-breadcrumbs';
import { formatStatusLabel } from '@/modules/platform-saas/companies/lib/saas-format';
import { NavHubBar } from '@/shared/components/NavHubBar';
import type { SaasNavDestination } from '@/modules/platform-saas/companies/lib/saas-nav';
import { SAAS } from '@/components/MerchantFrame/views/platform-saas/saas-scale';

const HOVER_PRIMARY = 'hover:text-primary transition-colors duration-200';

export function SaasBreadcrumbs({ items }: { items: SaasCrumb[] }) {
  const navigate = useNavigate();
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className={`flex flex-wrap items-center gap-x-1 gap-y-1 ${SAAS.caption} tracking-wider text-[#5f5e5e]`}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1 min-w-0">
              {item.to && !isLast ? (
                <button
                  type="button"
                  onClick={() => navigate(item.to as string)}
                  className={`truncate max-w-[14rem] cursor-pointer uppercase tracking-wider ${HOVER_PRIMARY}`}
                >
                  {item.label}
                </button>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={`truncate max-w-[14rem] ${isLast ? 'text-[#ae001a]' : ''}`}
                >
                  {item.label}
                </span>
              )}
              {!isLast && (
                <span aria-hidden="true" className={`material-symbols-outlined ${SAAS.iconSm} text-[#8a8880]`}>
                  chevron_right
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export interface SaasHeaderAction {
  label: string;
  icon?: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export function SaasPageHeader({
  breadcrumbs,
  icon,
  title,
  description,
  actions = [],
  children,
}: {
  breadcrumbs: SaasCrumb[];
  icon: string;
  title: string;
  description: string;
  actions?: SaasHeaderAction[];
  /** Controles de la cabecera secundaria bajo el título (p. ej. el selector de company). */
  children?: React.ReactNode;
}) {
  return (
    <header data-saas-header className={`${SAAS.surface} ${SAAS.cardPadding} font-poppins`}>
      <SaasBreadcrumbs items={breadcrumbs} />
      <div className="mt-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0 flex-1 flex items-start gap-3">
          <div data-saas-header-icon className="w-12 h-12 rounded-lg bg-[#fef9f1] border border-[#e8e2d8] flex items-center justify-center shrink-0">
            <span aria-hidden="true" className={`material-symbols-outlined ${SAAS.iconLg} text-[#ae001a]`}>
              {icon}
            </span>
          </div>
          <div className="min-w-0">
            <h1 className={SAAS.title}>{title}</h1>
            <p className={`${SAAS.body} mt-1 max-w-3xl`}>{description}</p>
          </div>
        </div>
        {actions.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                className={action.variant === 'secondary' ? SAAS.buttonSecondary : SAAS.buttonPrimary}
              >
                {action.icon && (
                  <span aria-hidden="true" className={`material-symbols-outlined ${SAAS.iconSm}`}>
                    {action.icon}
                  </span>
                )}
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {children && <div className="mt-4 pt-4 border-t border-[#f0ede6] min-w-0">{children}</div>}
    </header>
  );
}

export interface SaasStatItem {
  id: string;
  label: string;
  value: number | string;
  hint: string;
  icon: string;
}

const STAT_BORDERS = ['border-red-500', 'border-blue-500', 'border-amber-500', 'border-emerald-500'];

export function SaasStatCards({ stats, loading = false }: { stats: SaasStatItem[]; loading?: boolean }) {
  return (
    <section
      aria-label="Statistics"
      className={`grid grid-cols-1 sm:grid-cols-2 ${stats.length === 3 ? 'lg:grid-cols-3' : 'xl:grid-cols-4'} ${SAAS.gridGap} w-full font-poppins`}
    >
      {stats.map((stat, index) => (
        <div
          key={stat.id}
          data-testid={`stat-${stat.id}`}
          data-saas-stat
          className={`bg-[#222222] text-white ${SAAS.cardPadding} ${SAAS.radius} ${SAAS.statHeight} border-t-4 ${STAT_BORDERS[index % STAT_BORDERS.length]} shadow-sm flex flex-col justify-between min-w-0`}
        >
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className={`${SAAS.caption} tracking-wider text-zinc-400 truncate`}>{stat.label}</span>
            <span aria-hidden="true" className={`material-symbols-outlined ${SAAS.iconMd} text-zinc-300 shrink-0`}>
              {stat.icon}
            </span>
          </div>
          <div className="min-w-0">
            {/* divs, not p: the SaaS theme forces `.saas-active p` to 14px !important (tailwind.css) */}
            <div data-stat-value className="text-3xl font-black tracking-tight leading-none truncate">
              {loading ? '...' : stat.value}
            </div>
            <div data-stat-hint className="text-[11px] text-zinc-400 mt-1.5 truncate">
              {stat.hint}
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}

export interface SaasFeatureCard {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  actionText: string;
  onClick: () => void;
}

export function SaasFeatureCards({ cards }: { cards: SaasFeatureCard[] }) {
  return (
    <section
      aria-label="Features"
      className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 auto-rows-fr ${SAAS.gridGap} w-full font-poppins`}
    >
      {cards.map((card) => (
        <button
          key={card.id}
          type="button"
          data-testid={`feature-card-${card.id}`}
          data-saas-feature
          onClick={card.onClick}
          className={`group text-left bg-white border border-[#e8e2d8] hover:border-[#ae001a] ${SAAS.radius} ${SAAS.cardPadding} ${SAAS.featureMinHeight} h-full shadow-sm hover:shadow-md transition-colors duration-200 cursor-pointer flex flex-col min-w-0`}
        >
          <div className="min-w-0 flex-1">
            <div className="w-10 h-10 rounded-lg border border-[#e8e2d8] bg-[#fef9f1] group-hover:bg-[#ae001a] group-hover:border-[#ae001a] flex items-center justify-center transition-colors duration-200">
              <span
                aria-hidden="true"
                className={`material-symbols-outlined ${SAAS.iconMd} text-[#ae001a] group-hover:text-white transition-colors duration-200`}
              >
                {card.icon}
              </span>
            </div>
            {/* group-hover:text-primary! (important): the unlayered SaaS theme rule `.saas-active h3
                { color }` (tailwind.css) beats layered utilities, so a plain hover color never shows. */}
            <h3 className="mt-3 font-bold text-[15px] text-[#1d1c17] group-hover:text-primary! hover:text-primary transition-colors duration-200 leading-snug">
              {card.title}
            </h3>
            <p className="text-[10px] font-bold text-[#8a8880] uppercase tracking-wider mt-1 mb-2">{card.subtitle}</p>
            <p className="text-xs text-[#5f5e5e] leading-relaxed">{card.description}</p>
          </div>
          <div
            data-saas-feature-footer
            className="mt-4 pt-3 h-10 border-t border-[#f0ede6] flex items-center justify-between text-xs font-bold text-[#ae001a]"
          >
            <span className="truncate">{card.actionText}</span>
            <span aria-hidden="true" className={`material-symbols-outlined ${SAAS.iconSm} shrink-0`}>
              arrow_forward
            </span>
          </div>
        </button>
      ))}
    </section>
  );
}

/** Panel blanco con barra de título oscura (directorios, formularios, fichas). */
export function SaasPanel({
  title,
  meta,
  metaTestId,
  children,
}: {
  title: string;
  meta?: React.ReactNode;
  metaTestId?: string;
  children: React.ReactNode;
}) {
  return (
    <section data-saas-panel className={`${SAAS.surface} overflow-hidden`}>
      <div data-saas-panel-bar className={SAAS.panelBar}>
        <span className={SAAS.panelBarTitle}>{title}</span>
        {meta !== undefined && (
          <span className={SAAS.panelBarMeta} data-testid={metaTestId}>
            {meta}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

/** Buscador de los directorios (icono + input de altura SAAS.input). */
export function SaasSearchInput({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative min-w-0">
      <span
        aria-hidden="true"
        className={`material-symbols-outlined ${SAAS.iconMd} absolute left-3 top-1/2 -translate-y-1/2 text-[#5f5e5e]`}
      >
        search
      </span>
      <input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${SAAS.input} pl-10 border-[#e8e2d8]`}
      />
    </div>
  );
}

/** Select de filtro de los directorios. */
export function SaasFilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`${SAAS.input} border-[#e8e2d8]`}
    >
      {children}
    </select>
  );
}

/** Grupo de campos de un formulario (título con icono + rejilla de 2 columnas). */
export function SaasFormSection({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <fieldset data-saas-form-section className="px-5 py-5 border-b border-[#e8e2d8] last:border-b-0 min-w-0">
      <legend className="sr-only">{title}</legend>
      <div className="flex items-center gap-2 mb-4" aria-hidden="true">
        <span className={`material-symbols-outlined ${SAAS.iconMd} text-[#ae001a]`}>{icon}</span>
        <h2 className={`${SAAS.caption} text-[#5f5e5e]`}>{title}</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </fieldset>
  );
}

/** Pie de un formulario con sus botones (Discard / Save). */
export function SaasFormFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 py-4 bg-[#f8f3eb] border-t border-[#e8e2d8] flex flex-wrap items-center justify-end gap-3">
      {children}
    </div>
  );
}

const ALERT_CLASSES = {
  success: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  error: 'border-[#f5c2c7] bg-[#fff5f5] text-[#ba1a1a]',
  info: 'border-[#e8e2d8] bg-[#f8f3eb] text-[#5f5e5e]',
} as const;

const ALERT_ICONS = { success: 'check_circle', error: 'error', info: 'info' } as const;

/** Aviso en línea (éxito, error de envío, solo lectura). */
export function SaasAlert({
  tone,
  role,
  children,
}: {
  tone: keyof typeof ALERT_CLASSES;
  role?: 'status' | 'alert';
  children: React.ReactNode;
}) {
  return (
    <div className={`flex items-center gap-2 p-4 border ${SAAS.radius} text-sm break-words ${ALERT_CLASSES[tone]}`}>
      <span aria-hidden="true" className={`material-symbols-outlined ${SAAS.iconMd} shrink-0`}>
        {ALERT_ICONS[tone]}
      </span>
      {/* el rol va en el texto: el nombre del icono (ligadura) no forma parte del mensaje */}
      <div role={role} className="min-w-0 flex-1">
        {children}
      </div>
    </div>
  );
}

export function SaasLoadingState({ label }: { label: string }) {
  return (
    <div role="status" className={`${SAAS.surface} p-12 text-center font-poppins`}>
      <span aria-hidden="true" className={`material-symbols-outlined animate-spin text-primary ${SAAS.iconXl}`}>sync</span>
      <p className={`${SAAS.body} mt-2`}>{label}</p>
    </div>
  );
}

export function SaasErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className={`${SAAS.surface} p-12 text-center font-poppins`}>
      <span aria-hidden="true" className={`material-symbols-outlined text-[#ba1a1a] ${SAAS.iconXl}`}>error</span>
      <p className="text-[#ba1a1a] font-bold mt-2 break-words">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className={`mt-4 ${SAAS.buttonDark}`}>
          Retry
        </button>
      )}
    </div>
  );
}

export function SaasEmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="px-6 py-14 text-center font-poppins">
      <span aria-hidden="true" className={`material-symbols-outlined text-[#5f5e5e] ${SAAS.iconXl}`}>{icon}</span>
      {/* div y no p: el tema global fuerza `margin: 0` en los <p> (rompía el centrado) y
          `max-w-xl` resuelve al token de espaciado del tema, no a 36rem (texto en una columna). */}
      <div className="text-[#1d1c17] font-bold mt-2">{title}</div>
      <div className={`${SAAS.body} mt-1 mx-auto w-full max-w-[36rem]`}>{description}</div>
      {action && (
        <button type="button" onClick={action.onClick} className={`mt-4 ${SAAS.buttonDark}`}>
          {action.label}
        </button>
      )}
    </div>
  );
}

const STATUS_CLASSES: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  inactive: 'bg-zinc-100 text-zinc-700 border-zinc-300',
  suspended: 'bg-amber-100 text-amber-800 border-amber-300',
};

export function SaasStatusBadge({ status }: { status: string | null | undefined }) {
  const key = (status ?? '').toLowerCase();
  return (
    <span
      className={`inline-flex items-center h-6 px-2 rounded border text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
        STATUS_CLASSES[key] ?? 'bg-rose-100 text-rose-800 border-rose-300'
      }`}
    >
      {formatStatusLabel(status)}
    </span>
  );
}

/** Pestaña abierta sin el id que necesita en la URL (p. ej. desde un enlace antiguo). */
export function SaasMissingContext({ entity, onPick }: { entity: string; onPick: () => void }) {
  return (
    <div className={SAAS.surface}>
      <SaasEmptyState
        icon="travel_explore"
        title={`No ${entity} selected`}
        description={`Open a ${entity} from the Companies Directory to see this page.`}
        action={{ label: 'Open Companies Directory', onClick: onPick }}
      />
    </div>
  );
}

export function SaasField({
  id,
  label,
  error,
  required = false,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={SAAS.label}>
        {label}
        {required && <span className="text-[#ae001a]"> *</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-[#ba1a1a] break-words">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-[#8a8880]">{hint}</p>
      ) : null}
    </div>
  );
}

// ---- Barra de navegación inferior (NavHubBar) -----------------------------------------

export type { SaasNavDestination };

/**
 * Barra inferior fija de Platform SaaS: flecha atrás al padre lógico de la vista y botones a las
 * vistas hermanas. Es el NavHubBar estándar del backoffice (sustituye a Quick Launch).
 */
export function SaasNavBar({
  backLabel,
  backTo,
  items,
}: {
  backLabel: string;
  backTo: string;
  items: SaasNavDestination[];
}) {
  const navigate = useNavigate();
  return (
    <nav aria-label="Platform SaaS navigation" data-testid="saas-nav-bar">
      <NavHubBar
        title="PLATFORM SAAS"
        titleIcon="business"
        onBack={() => navigate(backTo)}
        backToDashboardLabel={backLabel}
        items={items
          .filter((item) => Boolean(item.to))
          .map((item) => ({
            id: `saas-nav-${item.id}`,
            label: item.label,
            icon: item.icon,
            active: item.active,
            keepLabel: true,
            onClick: () => navigate(item.to as string),
          }))}
      />
    </nav>
  );
}

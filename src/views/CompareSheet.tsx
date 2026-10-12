import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { unitIdentity } from '../config/active';
import { MAX_COMPARE } from '../lib/collections';
import { STATUS_COLORS } from '../lib/status';
import { useI18n, type I18n } from '../i18n/useI18n';
import type { TranslationKey } from '../i18n/translate';
import { CurrencyNote } from './CurrencyNote';
import { describeUnit, unitLink, type UnitDetails } from '../lib/unitDetails';
import { useCompareStore } from '../store/compareStore';
import { FloorPlanDetailed } from './FloorPlanDetailed';
import { Sheet } from './Sheet';
import type { Unit } from '../types';

/** Los índices con el mejor valor de una fila (el más bajo o el más alto), o ninguno si todos empatan: no hay "mejor". */
function bestIndexes(values: number[], better: 'min' | 'max'): Set<number> {
  if (values.length < 2) return new Set();
  const best = better === 'min' ? Math.min(...values) : Math.max(...values);
  const winners = new Set(values.flatMap((value, index) => (value === best ? [index] : [])));
  return winners.size === values.length ? new Set() : winners;
}

/** Anchos mínimos (rem) de la columna de etiquetas y de cada unidad; deben coincidir con `w-20` y `min-w-[7.5rem]` de abajo. */
const LABEL_COLUMN_REM = 5;
const UNIT_COLUMN_REM = 7.5;

interface Row {
  labelKey: TranslationKey;
  cell: (details: UnitDetails, i18n: I18n) => string;
  /** Si la fila tiene un valor "mejor" (más barato, más grande), cuál y sobre qué número se decide. */
  best?: { better: 'min' | 'max'; value: (details: UnitDetails) => number };
}

const ROWS: Row[] = [
  { labelKey: 'compare.area', cell: ({ unit }) => `${unit.m2} m²`, best: { better: 'max', value: ({ unit }) => unit.m2 } },
  { labelKey: 'compare.bedrooms', cell: ({ unit }) => String(unit.bedrooms) },
  { labelKey: 'compare.bathrooms', cell: ({ unit }) => String(unit.bathrooms) },
  { labelKey: 'compare.floor', cell: ({ unit }) => String(unit.floor) },
  { labelKey: 'compare.orientation', cell: ({ unit }, i18n) => i18n.orientation(unit.orientation) },
  { labelKey: 'compare.price', cell: ({ unit }, i18n) => i18n.money(unit.price), best: { better: 'min', value: ({ unit }) => unit.price } },
  { labelKey: 'compare.pricePerM2', cell: ({ pricePerM2 }, i18n) => i18n.money(pricePerM2), best: { better: 'min', value: ({ pricePerM2 }) => pricePerM2 } },
  {
    labelKey: 'compare.monthly',
    cell: ({ monthlyPayment, monthsCount }, i18n) => `${i18n.money(monthlyPayment)} × ${monthsCount}`,
    best: { better: 'min', value: ({ monthlyPayment }) => monthlyPayment },
  },
];

interface CompareSheetProps {
  /** Inventario actual: las unidades marcadas se leen de aquí, así precio y estado siempre están al día. */
  units: Unit[];
  /** Enganche (%) con que se calcula la mensualidad estimada, y cuántos meses dura la obra (para la nota al pie). */
  downPaymentPercent: number;
  constructionMonths: number;
}

/**
 * Comparador: hasta `MAX_COMPARE` unidades lado a lado — plano, superficie, recámaras, baños, piso, orientación,
 * precio, precio por m² y mensualidad estimada (la de obra, con el enganche inicial de la config). En cada fila se
 * resalta el mejor valor cuando las unidades difieren. Las unidades salen del inventario en vivo.
 */
export function CompareSheet({ units, downPaymentPercent, constructionMonths }: CompareSheetProps) {
  const i18n = useI18n();
  const { t } = i18n;
  const open = useCompareStore((state) => state.open);
  const keys = useCompareStore((state) => state.keys);
  const closeCompare = useCompareStore((state) => state.closeCompare);
  const remove = useCompareStore((state) => state.remove);
  const clear = useCompareStore((state) => state.clear);

  const items = useMemo(
    () =>
      keys.flatMap((key) => {
        const unit = unitIdentity.find(units, key);
        return unit ? [describeUnit(i18n, unit, downPaymentPercent)] : [];
      }),
    [keys, units, downPaymentPercent, i18n],
  );
  const loading = units.length === 0 && keys.length > 0;

  return (
    <Sheet open={open} onClose={closeCompare} title={t('compare.title')} size="lg">
      {loading && <p className="py-8 text-center text-sm text-neutral-500">{t('common.loadingUnits')}</p>}
      {!loading && items.length === 0 && (
        <p className="py-8 text-center text-sm text-neutral-500">{t('compare.empty')}</p>
      )}
      {!loading && items.length === 1 && (
        <p className="mb-3 rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
          {t('compare.addAnother', { max: MAX_COMPARE })}
        </p>
      )}

      {items.length > 0 && (
        <>
          <div className="-mx-5 overflow-x-auto px-5">
            {/* Ancho mínimo según cuántas unidades hay: con dos caben en un celular; con tres se desliza de lado (la columna de etiquetas se queda fija). */}
            <table className="w-full border-separate border-spacing-0 text-sm" style={{ minWidth: `${LABEL_COLUMN_REM + items.length * UNIT_COLUMN_REM}rem` }}>
              <thead>
                <tr>
                  <td className="sticky left-0 z-10 w-20 bg-white" />
                  {items.map(({ unit, buildingName }) => (
                    <th key={unitIdentity.param(unit)} scope="col" className="min-w-[7.5rem] px-1.5 pb-2 text-left align-top font-normal">
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          {buildingName && <p className="text-xs text-neutral-500">{buildingName}</p>}
                          <p className="font-serif text-lg leading-tight text-neutral-900">{t('unit.label', { code: unit.code })}</p>
                          <p className="text-xs text-neutral-500">{t('unit.type', { type: unit.type })}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => remove(unitIdentity.param(unit))}
                          aria-label={t('compare.remove', { code: unit.code })}
                          className="-mr-1 px-1 text-xl leading-none text-neutral-400 hover:text-neutral-700"
                        >
                          &times;
                        </button>
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-600">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: STATUS_COLORS[unit.status] }} />
                        {i18n.status(unit.status)}
                      </p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row" className="sticky left-0 z-10 bg-white py-2 pr-2 text-left align-top text-xs font-medium text-neutral-500">
                    {t('compare.plan')}
                  </th>
                  {items.map(({ unit, polygon, floorPlan }) => (
                    <td key={unitIdentity.param(unit)} className="px-1.5 py-2 align-top">
                      {polygon || floorPlan?.kind === 'image' ? (
                        <FloorPlanDetailed outline={polygon} plan={floorPlan} />
                      ) : (
                        <p className="rounded-lg bg-neutral-50 px-2 py-6 text-center text-xs text-neutral-400">{t('compare.noPlan')}</p>
                      )}
                    </td>
                  ))}
                </tr>

                {ROWS.map((row) => {
                  const winners = row.best ? bestIndexes(items.map(row.best.value), row.best.better) : new Set<number>();
                  return (
                    <tr key={row.labelKey}>
                      <th scope="row" className="sticky left-0 z-10 border-t border-neutral-100 bg-white py-2 pr-2 text-left align-top text-xs font-medium text-neutral-500">
                        {t(row.labelKey)}
                      </th>
                      {items.map((details, index) => (
                        <td
                          key={unitIdentity.param(details.unit)}
                          className={`border-t border-neutral-100 px-1.5 py-2 align-top ${
                            winners.has(index) ? 'bg-[var(--brand-accent)]/15 font-semibold text-neutral-900' : 'text-neutral-800'
                          }`}
                        >
                          {row.cell(details, i18n)}
                        </td>
                      ))}
                    </tr>
                  );
                })}

                <tr>
                  <td className="sticky left-0 z-10 border-t border-neutral-100 bg-white" />
                  {items.map(({ unit }) => (
                    <td key={unitIdentity.param(unit)} className="border-t border-neutral-100 px-1.5 pt-3 align-top">
                      <Link
                        to={unitLink(unit)}
                        onClick={closeCompare}
                        className="inline-block rounded-full border border-[var(--brand-primary)] px-3 py-1.5 text-xs font-medium text-[var(--brand-primary)]"
                      >
                        {t('compare.viewUnit')}
                      </Link>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-neutral-500">{t('compare.footnote', { months: constructionMonths, percent: downPaymentPercent })}</p>
          <CurrencyNote className="mt-1 text-xs text-neutral-500" />
          <button type="button" onClick={clear} className="mt-3 text-sm text-neutral-500 underline underline-offset-2 hover:text-neutral-800">
            {t('compare.clear')}
          </button>
        </>
      )}
    </Sheet>
  );
}

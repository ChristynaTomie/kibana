/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import {
  DateHistogramIndexPatternColumn,
  PersistedIndexPatternLayer,
  TermsIndexPatternColumn,
} from '@kbn/lens-plugin/public';
import type { DataView, DataViewSpec } from '@kbn/data-views-plugin/public';
import type { SavedObjectReference } from '@kbn/core-saved-objects-common';

export const DEFAULT_LAYER_ID = 'layer1';
export const DEFAULT_AD_HOC_DATA_VIEW_ID = 'infra_lens_ad_hoc_default';
const DEFAULT_BREAKDOWN_SIZE = 10;

export const getHistogramColumn = ({
  columnName,
  overrides,
}: {
  columnName: string;
  overrides?: Partial<Pick<DateHistogramIndexPatternColumn, 'sourceField' | 'params'>>;
}) => {
  return {
    [columnName]: {
      dataType: 'date',
      isBucketed: true,
      label: '@timestamp',
      operationType: 'date_histogram',
      scale: 'interval',
      sourceField: '@timestamp',
      ...overrides,
      params: { interval: 'auto', ...overrides?.params },
    } as DateHistogramIndexPatternColumn,
  };
};

export const getBreakdownColumn = ({
  columnName,
  overrides,
}: {
  columnName: string;
  overrides?: Partial<Pick<TermsIndexPatternColumn, 'sourceField'>> & {
    breakdownSize?: number;
  };
}): PersistedIndexPatternLayer['columns'] => {
  const { breakdownSize = DEFAULT_BREAKDOWN_SIZE, sourceField } = overrides ?? {};
  return {
    [columnName]: {
      label: `Top ${breakdownSize} values of ${sourceField}`,
      dataType: 'string',
      operationType: 'terms',
      scale: 'ordinal',
      sourceField,
      isBucketed: true,
      params: {
        size: breakdownSize,
        orderBy: {
          type: 'alphabetical',
          fallback: false,
        },
        orderDirection: 'asc',
        otherBucket: false,
        missingBucket: false,
        parentFormat: {
          id: 'terms',
        },
        include: [],
        exclude: [],
        includeIsRegex: false,
        excludeIsRegex: false,
      },
    } as TermsIndexPatternColumn,
  };
};

export const getDefaultReferences = (
  dataView: DataView,
  dataLayerId: string
): SavedObjectReference[] => {
  return [
    {
      type: 'index-pattern',
      id: dataView.id ?? DEFAULT_AD_HOC_DATA_VIEW_ID,
      name: `indexpattern-datasource-layer-${dataLayerId}`,
    },
  ];
};

export const getAdhocDataView = (dataView: DataView): Record<string, DataViewSpec> => {
  return {
    [dataView.id ?? DEFAULT_AD_HOC_DATA_VIEW_ID]: {
      ...dataView.toSpec(),
    },
  };
};

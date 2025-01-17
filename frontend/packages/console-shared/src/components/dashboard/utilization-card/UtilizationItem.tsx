import * as React from 'react';
import { Humanize } from '@console/internal/components/utils/types';
import { AreaChart, AreaChartStatus } from '@console/internal/components/graphs/area';
import { DataPoint } from '@console/internal/components/graphs';

export const UtilizationItem: React.FC<UtilizationItemProps> = React.memo(
  ({ title, data, humanizeValue, isLoading = false, query, error, max = null }) => {
    let current;
    if (data.length) {
      const latestData = data[data.length - 1];
      current = humanizeValue(latestData.y).string;
    }

    let humanMax;
    let chartStatus;

    if (current && max) {
      humanMax = humanizeValue(max).string;
      const percentage = (100 * data[data.length - 1].y) / max;

      if (percentage >= 90) {
        chartStatus = AreaChartStatus.ERROR;
      } else if (percentage >= 75) {
        chartStatus = AreaChartStatus.WARNING;
      }
    }

    const chart = (
      <AreaChart
        data={error ? [] : data}
        loading={!error && isLoading}
        query={query}
        xAxis={false}
        humanize={humanizeValue}
        padding={{ top: 13, left: 70, bottom: 0, right: 0 }}
        height={80}
        chartStatus={chartStatus}
      />
    );

    return (
      <div className="co-utilization-card__item">
        <div className="co-utilization-card__item__section">
          <div className="pf-l-level">
            <h4 className="pf-c-title pf-m-md">{title}</h4>
            {current}
          </div>
          <div className="pf-l-level">
            <span className="co-utilization-card__item__text" />
            <span className="co-utilization-card__item__text">
              {humanMax && <span>of {humanMax}</span>}
            </span>
          </div>
        </div>
        <div className="co-utilization-card__item__chart">{chart}</div>
      </div>
    );
  },
);

export default UtilizationItem;

type UtilizationItemProps = {
  title: string;
  data?: DataPoint[];
  isLoading: boolean;
  humanizeValue: Humanize;
  query: string;
  error: boolean;
  max?: number;
};

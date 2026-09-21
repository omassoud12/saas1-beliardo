import { useCallback, useEffect, useState } from "react";
import { getBusinessAnalysis, getBusinessOverview, getDailySummary, getMonthlySummary, getStationPerformance, getYearlySummary } from "../lib/businessSummaryApi";
import { invalidateBusinessRequest, readBusinessRequest } from "../lib/businessRequestCache";

function useQuery(load, dependencies, enabled = true, cacheKey = null) {
  const requestKey = JSON.stringify([enabled, ...dependencies]);
  const [state, setState] = useState({ requestKey: null, data: null, error: null, loading: true });
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => {
    if (cacheKey) invalidateBusinessRequest(cacheKey);
    setRevision((value) => value + 1);
  }, [cacheKey]);

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = cacheKey ? null : new AbortController();
    let cancelled = false;
    setState({ requestKey, data: null, error: null, loading: true });
    const request = cacheKey
      ? readBusinessRequest(cacheKey, () => load(undefined))
      : load(controller.signal);
    request
      .then((data) => {
        if (!cancelled) setState({ requestKey, data, error: null, loading: false });
      })
      .catch((error) => {
        if (error.name !== "AbortError" && !cancelled) setState({ requestKey, data: null, error, loading: false });
      });
    return () => { cancelled = true; controller?.abort(); };
  }, [...dependencies, revision, enabled, requestKey, cacheKey]);

  const current = state.requestKey === requestKey
    ? state
    : { requestKey, data: null, error: null, loading: true };
  return { ...current, retry };
}

export function useDailySummary(date) {
  return useQuery((signal) => getDailySummary(date, signal), [date]);
}

export function useMonthlySummary(year, month) {
  return useQuery((signal) => getMonthlySummary(year, month, signal), [year, month]);
}

export function useYearlySummary(year) {
  return useQuery((signal) => getYearlySummary(year, signal), [year]);
}

export function useBusinessAnalysis(period, parameters, enabled = true, businessId = "unknown") {
  const key = JSON.stringify(parameters);
  const cacheKey = `business:${businessId}:analysis:${period}:${key}`;
  return useQuery((signal) => getBusinessAnalysis(period, parameters, signal), [period, key], enabled, cacheKey);
}

export function useBusinessOverview(period, parameters, enabled = true, businessId = "unknown") {
  const key = JSON.stringify(parameters);
  const cacheKey = `business:${businessId}:overview:${period}:${key}`;
  return useQuery((signal) => getBusinessOverview(period, parameters, signal), [period, key], enabled, cacheKey);
}

export function useStationPerformance(period, parameters, businessId = "unknown") {
  const key = JSON.stringify(parameters);
  const cacheKey = `business:${businessId}:stations:${period}:${key}`;
  return useQuery((signal) => getStationPerformance(period, parameters, signal), [period, key], true, cacheKey);
}

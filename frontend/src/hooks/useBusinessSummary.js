import { useCallback, useEffect, useState } from "react";
import { getDailySummary, getMonthlySummary, getYearlySummary } from "../lib/businessSummaryApi";

function useQuery(load, dependencies) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, error: null, loading: true }));
    load(controller.signal)
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => {
        if (error.name !== "AbortError") setState({ data: null, error, loading: false });
      });
    return () => controller.abort();
  }, [...dependencies, revision]);

  return { ...state, retry };
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

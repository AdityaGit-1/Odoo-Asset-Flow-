"use client";

// Small reference lists (departments, categories, employees) cached once and
// joined client-side wherever ids need names.

import { categories, departments, employees } from "@/api/org";
import { useQuery } from "@tanstack/react-query";

const STALE = 5 * 60_000;

export function useDepartments() {
  return useQuery({ queryKey: ["departments"], queryFn: departments.list, staleTime: STALE });
}

export function useCategories() {
  return useQuery({ queryKey: ["categories"], queryFn: categories.list, staleTime: STALE });
}

export function useEmployees() {
  return useQuery({ queryKey: ["employees"], queryFn: () => employees.list(), staleTime: STALE });
}

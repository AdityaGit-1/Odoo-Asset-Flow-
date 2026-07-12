"use client";

import { CategoriesTab } from "@/components/org/categories-tab";
import { DepartmentsTab } from "@/components/org/departments-tab";
import { EmployeesTab } from "@/components/org/employees-tab";
import { PageHeader } from "@/components/shell/page-header";
import { RoleGate } from "@/components/shell/role-gate";
import { Tabs } from "@/components/ui/tabs";
import { useState } from "react";

export default function OrgSetupPage() {
  const [tab, setTab] = useState("departments");

  return (
    <RoleGate roles={["ADMIN"]}>
      <PageHeader title="Org setup" sub="Departments, asset categories, and the employee directory" />
      <Tabs
        className="mb-4"
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "departments", label: "Departments" },
          { key: "categories", label: "Categories" },
          { key: "employees", label: "Employee directory" },
        ]}
      />
      {tab === "departments" && <DepartmentsTab />}
      {tab === "categories" && <CategoriesTab />}
      {tab === "employees" && <EmployeesTab />}
    </RoleGate>
  );
}

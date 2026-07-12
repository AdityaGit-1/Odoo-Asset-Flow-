package com.example.assetflowlogin.repository;

import com.example.assetflowlogin.entity.Department;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DepartmentRepository extends JpaRepository<Department, Long> {
}
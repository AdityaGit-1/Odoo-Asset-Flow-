package com.example.assetflowlogin.repository;

import com.example.assetflowlogin.entity.AuditRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AuditRecordRepository extends JpaRepository<AuditRecord, Long> {
    List<AuditRecord> findByAuditCycleId(Long cycleId);
}

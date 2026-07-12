package com.example.assetflowlogin.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import com.example.assetflowlogin.entity.MaintainenceRequest;

@Repository
public interface MaintainenceRequestRepository extends JpaRepository<MaintainenceRequest, Long> {
    // Standard CRUD methods inherited seamlessly
}
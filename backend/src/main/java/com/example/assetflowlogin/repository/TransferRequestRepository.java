package com.example.assetflowlogin.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import com.example.assetflowlogin.entity.TransferRequest;

@Repository
public interface TransferRequestRepository extends JpaRepository<TransferRequest, Long> {
    // Basic CRUD operations are inherited automatically
}

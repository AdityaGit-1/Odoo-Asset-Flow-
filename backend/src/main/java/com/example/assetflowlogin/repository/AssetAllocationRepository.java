package com.example.assetflowlogin.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import com.example.assetflowlogin.entity.AssetAllocation;
import java.util.Optional;

@Repository
public interface AssetAllocationRepository extends JpaRepository<AssetAllocation, Long> {

    @Query("SELECT aa FROM AssetAllocation aa WHERE aa.asset.id = :assetId AND aa.actualReturnDate IS NULL")
    List<AssetAllocation> findActiveAllocationByAssetId(@Param("assetId") Long assetId);
}
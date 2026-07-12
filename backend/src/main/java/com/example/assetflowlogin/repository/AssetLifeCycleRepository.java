package com.example.assetflowlogin.repository;

import com.example.assetflowlogin.entity.AssetLifecycle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AssetLifecycleRepository extends JpaRepository<AssetLifecycle, Long> {

    List<AssetLifecycle> findByAssetIdOrderByChangedAtDesc(Long assetId);
}
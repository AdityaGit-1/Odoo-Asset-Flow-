package com.example.assetflowlogin.repository;

import com.example.assetflowlogin.entity.Asset;
import com.example.assetflowlogin.enums.AssetStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AssetRepository extends JpaRepository<Asset, Long> {

    Optional<Asset> findByAssetTag(String assetTag);

    Optional<Asset> findBySerialNumber(String serialNumber);

    boolean existsByAssetTag(String assetTag);

    boolean existsBySerialNumber(String serialNumber);

    List<Asset> findByStatus(AssetStatus status);
}
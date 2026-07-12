package com.example.assetflowlogin.service;

import com.example.assetflowlogin.entity.Asset;
import com.example.assetflowlogin.enums.AssetStatus;

import java.util.List;
import java.util.Optional;

public interface AssetService {

    Asset create(Asset asset);

    Asset update(Long id, Asset asset);

    void delete(Long id);

    Asset getById(Long id);

    List<Asset> getAll();

    Optional<Asset> getByAssetTag(String assetTag);

    List<Asset> getByStatus(AssetStatus status);

    Asset updateStatus(Long id, AssetStatus status);

    boolean exists(Long id);
}
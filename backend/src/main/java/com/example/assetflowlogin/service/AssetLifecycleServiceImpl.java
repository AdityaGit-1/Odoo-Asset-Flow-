package com.example.assetflowlogin.service;

import com.example.assetflowlogin.entity.Asset;
import com.example.assetflowlogin.entity.AssetLifecycle;
import com.example.assetflowlogin.enums.AssetStatus;
import com.example.assetflowlogin.exceptions.AssetNotFoundException;
import com.example.assetflowlogin.repository.AssetLifecycleRepository;
import com.example.assetflowlogin.repository.AssetRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@Transactional
public class AssetLifecycleServiceImpl implements AssetLifecycleService {

    private final AssetLifecycleRepository assetLifecycleRepository;
    private final AssetRepository assetRepository;

    public AssetLifecycleServiceImpl(AssetLifecycleRepository assetLifecycleRepository,
                                      AssetRepository assetRepository) {
        this.assetLifecycleRepository = assetLifecycleRepository;
        this.assetRepository = assetRepository;
    }

    @Override
    public AssetLifecycle recordStatusChange(Asset asset, AssetStatus previousStatus, AssetStatus newStatus, String remarks) {
        AssetLifecycle history = new AssetLifecycle();
        history.setAsset(asset);
        history.setPreviousStatus(previousStatus);
        history.setNewStatus(newStatus);
        history.setRemarks(remarks);
        history.setChangedAt(LocalDateTime.now());

        return assetLifecycleRepository.save(history);
    }

    @Override
    public AssetLifecycle changeStatus(Long assetId, AssetStatus newStatus, String remarks) {
        Asset asset = assetRepository.findById(assetId)
                .orElseThrow(() -> new AssetNotFoundException("Asset not found with id: " + assetId));

        AssetStatus previousStatus = asset.getStatus();
        asset.setStatus(newStatus);
        Asset updated = assetRepository.save(asset);

        return recordStatusChange(updated, previousStatus, newStatus, remarks);
    }

    @Override
    public List<AssetLifecycle> getHistory(Long assetId) {
        return assetLifecycleRepository.findByAssetIdOrderByChangedAtDesc(assetId);
    }
}
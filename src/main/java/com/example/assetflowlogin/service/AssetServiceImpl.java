package com.example.assetflowlogin.service;

import com.example.assetflowlogin.entity.Asset;
import com.example.assetflowlogin.entity.AssetCategory;
import com.example.assetflowlogin.enums.AssetStatus;
import com.example.assetflowlogin.exceptions.AssetCategoryNotFoundException;
import com.example.assetflowlogin.exceptions.AssetNotFoundException;
import com.example.assetflowlogin.exceptions.DuplicateAssetException;
import com.example.assetflowlogin.repository.AssetCategoryRepository;
import com.example.assetflowlogin.repository.AssetRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class AssetServiceImpl implements AssetService {

    private final AssetRepository assetRepository;
    private final AssetCategoryRepository assetCategoryRepository;

    public AssetServiceImpl(AssetRepository assetRepository,
                             AssetCategoryRepository assetCategoryRepository) {
        this.assetRepository = assetRepository;
        this.assetCategoryRepository = assetCategoryRepository;
    }

    @Override
    public Asset create(Asset asset) {
        validateRequiredFields(asset);

        if (assetRepository.existsByAssetTag(asset.getAssetTag())) {
            throw new DuplicateAssetException("Asset already exists with assetTag: " + asset.getAssetTag());
        }

        if (assetRepository.existsBySerialNumber(asset.getSerialNumber())) {
            throw new DuplicateAssetException("Asset already exists with serialNumber: " + asset.getSerialNumber());
        }

        AssetCategory category = assetCategoryRepository.findById(asset.getCategory().getId())
                .orElseThrow(() -> new AssetCategoryNotFoundException(
                        "AssetCategory not found with id: " + asset.getCategory().getId()));
        asset.setCategory(category);

        return assetRepository.save(asset);
    }

    @Override
    public Asset update(Long id, Asset asset) {
        Asset existing = assetRepository.findById(id)
                .orElseThrow(() -> new AssetNotFoundException("Asset not found with id: " + id));

        validateRequiredFields(asset);

        assetRepository.findByAssetTag(asset.getAssetTag())
                .filter(found -> !found.getId().equals(id))
                .ifPresent(found -> {
                    throw new DuplicateAssetException("Asset already exists with assetTag: " + asset.getAssetTag());
                });

        assetRepository.findBySerialNumber(asset.getSerialNumber())
                .filter(found -> !found.getId().equals(id))
                .ifPresent(found -> {
                    throw new DuplicateAssetException("Asset already exists with serialNumber: " + asset.getSerialNumber());
                });

        AssetCategory category = assetCategoryRepository.findById(asset.getCategory().getId())
                .orElseThrow(() -> new AssetCategoryNotFoundException(
                        "AssetCategory not found with id: " + asset.getCategory().getId()));

        existing.setAssetTag(asset.getAssetTag());
        existing.setSerialNumber(asset.getSerialNumber());
        existing.setName(asset.getName());
        existing.setCategory(category);
        existing.setAcquisitionDate(asset.getAcquisitionDate());
        existing.setAcquisitionCost(asset.getAcquisitionCost());
        existing.setCondition(asset.getCondition());
        existing.setLocation(asset.getLocation());
        existing.setStatus(asset.getStatus());
        existing.setBookable(asset.getBookable());
        existing.setPhotoUrl(asset.getPhotoUrl());

        return assetRepository.save(existing);
    }

    @Override
    public void delete(Long id) {
        Asset existing = assetRepository.findById(id)
                .orElseThrow(() -> new AssetNotFoundException("Asset not found with id: " + id));

        assetRepository.delete(existing);
    }

    @Override
    public Asset getById(Long id) {
        return assetRepository.findById(id)
                .orElseThrow(() -> new AssetNotFoundException("Asset not found with id: " + id));
    }

    @Override
    public List<Asset> getAll() {
        return assetRepository.findAll();
    }

    @Override
    public Optional<Asset> getByAssetTag(String assetTag) {
        return assetRepository.findByAssetTag(assetTag);
    }

    @Override
    public List<Asset> getByStatus(AssetStatus status) {
        return assetRepository.findByStatus(status);
    }

    @Override
    public Asset updateStatus(Long id, AssetStatus status) {
        Asset existing = assetRepository.findById(id)
                .orElseThrow(() -> new AssetNotFoundException("Asset not found with id: " + id));

        existing.setStatus(status);

        return assetRepository.save(existing);
    }

    @Override
    public boolean exists(Long id) {
        return assetRepository.existsById(id);
    }

    private void validateRequiredFields(Asset asset) {
        if (asset.getAssetTag() == null || asset.getAssetTag().isBlank()) {
            throw new IllegalArgumentException("assetTag must not be null or blank");
        }
        if (asset.getSerialNumber() == null || asset.getSerialNumber().isBlank()) {
            throw new IllegalArgumentException("serialNumber must not be null or blank");
        }
        if (asset.getName() == null || asset.getName().isBlank()) {
            throw new IllegalArgumentException("name must not be null or blank");
        }
        if (asset.getCategory() == null || asset.getCategory().getId() == null) {
            throw new IllegalArgumentException("category must not be null");
        }
        if (asset.getStatus() == null) {
            throw new IllegalArgumentException("status must not be null");
        }
        if (asset.getBookable() == null) {
            throw new IllegalArgumentException("bookable must not be null");
        }
    }
} 

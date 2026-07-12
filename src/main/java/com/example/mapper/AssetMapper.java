package com.example.mapper;

import com.example.assetflowlogin.dto.request.CreateAssetRequest;
import com.example.assetflowlogin.dto.request.UpdateAssetRequest;
import com.example.assetflowlogin.dto.response.AssetCategoryResponse;
import com.example.assetflowlogin.dto.response.AssetResponse;
import com.example.assetflowlogin.entity.Asset;
import com.example.assetflowlogin.entity.AssetCategory;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class AssetMapper {

    public Asset toEntity(CreateAssetRequest request) {
        Asset asset = new Asset();
        asset.setAssetTag(request.getAssetTag());
        asset.setSerialNumber(request.getSerialNumber());
        asset.setName(request.getName());
        asset.setAcquisitionDate(request.getAcquisitionDate());
        asset.setAcquisitionCost(request.getAcquisitionCost());
        asset.setCondition(request.getCondition());
        asset.setLocation(request.getLocation());
        asset.setStatus(request.getStatus());
        asset.setBookable(request.getBookable());
        asset.setPhotoUrl(request.getPhotoUrl());
        asset.setCategory(null);
        return asset;
    }

    public void updateEntity(UpdateAssetRequest request, Asset existing) {
        existing.setAssetTag(request.getAssetTag());
        existing.setSerialNumber(request.getSerialNumber());
        existing.setName(request.getName());
        existing.setAcquisitionDate(request.getAcquisitionDate());
        existing.setAcquisitionCost(request.getAcquisitionCost());
        existing.setCondition(request.getCondition());
        existing.setLocation(request.getLocation());
        existing.setStatus(request.getStatus());
        existing.setBookable(request.getBookable());
        existing.setPhotoUrl(request.getPhotoUrl());
    }

    public AssetResponse toResponse(Asset asset) {
        AssetResponse response = new AssetResponse();
        response.setId(asset.getId());
        response.setAssetTag(asset.getAssetTag());
        response.setSerialNumber(asset.getSerialNumber());
        response.setName(asset.getName());
        response.setCategoryId(asset.getCategory().getId());
        response.setCategoryName(asset.getCategory().getName());
        response.setAcquisitionDate(asset.getAcquisitionDate());
        response.setAcquisitionCost(asset.getAcquisitionCost());
        response.setCondition(asset.getCondition());
        response.setLocation(asset.getLocation());
        response.setStatus(asset.getStatus());
        response.setBookable(asset.getBookable());
        response.setPhotoUrl(asset.getPhotoUrl());
        response.setCreatedAt(asset.getCreatedAt());
        response.setUpdatedAt(asset.getUpdatedAt());
        return response;
    }

    public AssetCategoryResponse toCategoryResponse(AssetCategory category) {
        AssetCategoryResponse response = new AssetCategoryResponse();
        response.setId(category.getId());
        response.setName(category.getName());
        response.setDescription(category.getDescription());
        return response;
    }

    public List<AssetResponse> toResponseList(List<Asset> assets) {
        return assets.stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }
}
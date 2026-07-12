package com.example.assetflowlogin.service;

import com.example.assetflowlogin.dto.request.AssetAllocationRequestDTO;
import com.example.assetflowlogin.entity.AssetAllocation;

public interface AssetAllocationService {
    AssetAllocation allocateAsset(AssetAllocationRequestDTO requestDTO);
}
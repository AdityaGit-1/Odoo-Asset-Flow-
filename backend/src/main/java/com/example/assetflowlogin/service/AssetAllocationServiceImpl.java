package com.example.assetflowlogin.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.assetflowlogin.dto.request.AssetAllocationRequestDTO;
import com.example.assetflowlogin.entity.AssetAllocation;
import com.example.assetflowlogin.entity.Asset;
import com.example.assetflowlogin.entity.User;
import com.example.assetflowlogin.exceptions.AssetAlreadyAllocatedException;
import com.example.assetflowlogin.exceptions.ResourceNotFoundException; // Adjust if your team uses a different name
import com.example.assetflowlogin.repository.AssetAllocationRepository;
import com.example.assetflowlogin.repository.AssetRepository; // Assuming this exists
import com.example.assetflowlogin.repository.UserRepository;  // Assuming this exists

import java.time.LocalDate;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class AssetAllocationServiceImpl implements AssetAllocationService {

    private final AssetAllocationRepository allocationRepository;
    private final AssetRepository assetRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional
    public AssetAllocation allocateAsset(AssetAllocationRequestDTO requestDTO) {
        // 1. Check if the asset is already allocated right now
        Optional<AssetAllocation> activeAllocation = allocationRepository
                .findActiveAllocationByAssetId(requestDTO.getAssetId());

        if (activeAllocation.isPresent()) {
            Long currentHolderId = activeAllocation.get().getUser().getId();
            throw new AssetAlreadyAllocatedException(
                "Asset ID " + requestDTO.getAssetId() + " is already allocated to User ID " + currentHolderId + 
                ". Please initiate an Asset Transfer instead."
            );
        }

        // 2. Fetch asset and user to create new allocation
        Asset asset = assetRepository.findById(requestDTO.getAssetId())
                .orElseThrow(() -> new RuntimeException("Asset not found"));
        User user = userRepository.findById(requestDTO.getUserId())
                .orElseThrow(() -> new RuntimeException("User not found"));

        // 3. Build and save the new allocation
        AssetAllocation allocation = new AssetAllocation();
        allocation.setAsset(asset);
        allocation.setUser(user);
        allocation.setAllocatedDate(LocalDate.now());
        allocation.setExpectedReturnDate(requestDTO.getExpectedReturnDate());
        
        return allocationRepository.save(allocation);
    }
}
package com.example.assetflowlogin.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.assetflowlogin.dto.request.MaintenanceRequestDTO;
import com.example.assetflowlogin.dto.response.MaintenanceResponseDTO;
import com.example.assetflowlogin.entity.Asset;
import com.example.assetflowlogin.entity.MaintainenceRequest;
import com.example.assetflowlogin.entity.User;
import com.example.assetflowlogin.enums.MaintainenceStatus;
import com.example.assetflowlogin.enums.Priority;
import com.example.assetflowlogin.exceptions.AssetNotAvailableException;
import com.example.assetflowlogin.repository.AssetRepository;
import com.example.assetflowlogin.repository.MaintainenceRequestRepository;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AssetMaintenanceServiceImpl implements AssetMaintenanceService {

    private final MaintainenceRequestRepository maintenanceRepository;
    private final AssetRepository assetRepository;

    @Override
    @Transactional
    public MaintenanceResponseDTO createRequest(MaintenanceRequestDTO dto, User requester) {
        Asset asset = assetRepository.findById(dto.assetId())
            .orElseThrow(() -> new AssetNotAvailableException("Asset not found with ID: " + dto.assetId()));

        MaintainenceRequest request = MaintainenceRequest.builder()
            .asset(asset)
            .raisedBy(requester)
            .description(dto.description())
            .priority(Priority.valueOf(dto.priority().toUpperCase()))
            .status(MaintainenceStatus.PENDING)
            .build();

        MaintainenceRequest saved = maintenanceRepository.save(request);
        return mapToResponseDTO(saved);
    }

    private MaintenanceResponseDTO mapToResponseDTO(MaintainenceRequest request) {
        return MaintenanceResponseDTO.builder()
            .id(request.getId())
            .assetId(request.getAsset().getId())
            .assetName(request.getAsset().getName())
            .description(request.getDescription())
            .priority(request.getPriority().name())
            .status(request.getStatus().name())
            .createdAt(LocalDateTime.now())
            .build();
    }
}
package com.example.assetflowlogin.service;

import com.example.assetflowlogin.dto.request.MaintenanceRequestDTO;
import com.example.assetflowlogin.dto.response.MaintenanceResponseDTO;
import com.example.assetflowlogin.entity.User;

public interface AssetMaintenanceService {
    MaintenanceResponseDTO createRequest(MaintenanceRequestDTO dto, User requester);
}
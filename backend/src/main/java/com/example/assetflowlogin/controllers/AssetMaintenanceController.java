package com.example.assetflowlogin.controllers;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.example.assetflowlogin.dto.request.MaintenanceRequestDTO;
import com.example.assetflowlogin.dto.response.MaintenanceResponseDTO;
import com.example.assetflowlogin.entity.User;
import com.example.assetflowlogin.service.AssetMaintenanceService;

@RestController
@RequestMapping("/api/maintenance")
@RequiredArgsConstructor
public class AssetMaintenanceController {

    private final AssetMaintenanceService maintenanceService;

    @PostMapping
    public ResponseEntity<MaintenanceResponseDTO> createRequest(
            @RequestBody MaintenanceRequestDTO requestDTO
    ) {
        // Temporary placeholder User context instantiation to fulfill signature requirements 
        // until session context hooks are integrated.
        User mockUser = new User();
        
        MaintenanceResponseDTO response = maintenanceService.createRequest(requestDTO, mockUser);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
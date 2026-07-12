package com.example.assetflowlogin.controllers;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.example.assetflowlogin.dto.request.AssetAllocationRequestDTO;
import com.example.assetflowlogin.entity.AssetAllocation;
import com.example.assetflowlogin.service.AssetAllocationService;

@RestController
@RequestMapping("/api/allocations")
@RequiredArgsConstructor
public class AssetAllocationController {

    private final AssetAllocationService allocationService;

    @PostMapping
    public ResponseEntity<AssetAllocation> allocateAsset(@RequestBody AssetAllocationRequestDTO requestDTO) {
        AssetAllocation savedAllocation = allocationService.allocateAsset(requestDTO);
        return new ResponseEntity<>(savedAllocation, HttpStatus.CREATED);
    }
}
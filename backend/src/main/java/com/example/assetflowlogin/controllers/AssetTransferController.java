package com.example.assetflowlogin.controllers;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.example.assetflowlogin.dto.request.TransferRequestDTO;
import com.example.assetflowlogin.dto.response.TransferResponseDTO;
import com.example.assetflowlogin.entity.User;
import com.example.assetflowlogin.service.AssetTransferService;

@RestController
@RequestMapping("/api/transfers")
@RequiredArgsConstructor
public class AssetTransferController {

    private final AssetTransferService transferService;

    @PostMapping
    public ResponseEntity<TransferResponseDTO> createTransfer(
            @RequestBody TransferRequestDTO requestDTO
    ) {
        // Temporary placeholder User instance to pass down until you plug in your authentication mechanism
        User mockSender = new User();
        
        TransferResponseDTO response = transferService.initiateTransfer(requestDTO, mockSender);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
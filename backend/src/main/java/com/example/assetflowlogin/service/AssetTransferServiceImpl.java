package com.example.assetflowlogin.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.assetflowlogin.dto.request.TransferRequestDTO;
import com.example.assetflowlogin.dto.response.TransferResponseDTO;
import com.example.assetflowlogin.entity.*;
import com.example.assetflowlogin.exception.AssetNotAvailableException;
import com.example.assetflowlogin.repository.AssetRepository;
import com.example.assetflowlogin.repository.TransferRequestRepository;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AssetTransferServiceImpl implements AssetTransferService {

    private final TransferRequestRepository transferRepository;
    private final AssetRepository assetRepository;

    @Override
    @Transactional
    public TransferResponseDTO initiateTransfer(TransferRequestDTO dto, User sender) {
        Asset asset = assetRepository.findById(dto.assetId())
            .orElseThrow(() -> new AssetNotAvailableException("Asset not found with ID: " + dto.assetId()));

        // Create the transfer record using the existing TransferRequest entity structure
        TransferRequest transferRequest = TransferRequest.builder()
            .asset(asset)
            .sender(sender)
            // Note: Since User handling logic requires mapping targetUserId, 
            // a placeholder user shell matches the database reference constraint
            .receiver(User.builder().id(dto.targetUserId()).build())
            .status(TransferStatus.PENDING)
            .reason(dto.reason())
            .build();

        TransferRequest savedRequest = transferRepository.save(transferRequest);
        return mapToResponseDTO(savedRequest);
    }

    private TransferResponseDTO mapToResponseDTO(TransferRequest request) {
        return TransferResponseDTO.builder()
            .id(request.getId())
            .assetId(request.getAsset().getId())
            .assetName(request.getAsset().getName())
            .senderId(request.getSender().getId())
            .senderEmail(request.getSender().getEmail())
            .receiverId(request.getReceiver().getId())
            .receiverEmail(request.getReceiver().getEmail())
            .status(request.getStatus())
            .reason(request.getReason())
            .createdAt(LocalDateTime.now())
            .build();
    }
}
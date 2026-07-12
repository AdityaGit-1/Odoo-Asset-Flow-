package com.example.assetflowlogin.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.assetflowlogin.dto.request.TransferRequestDTO;
import com.example.assetflowlogin.dto.response.TransferResponseDTO;
import com.example.assetflowlogin.entity.*;
import com.example.assetflowlogin.enums.TransferStatus;
import com.example.assetflowlogin.exceptions.AssetNotAvailableException;
import com.example.assetflowlogin.repository.AssetRepository;
import com.example.assetflowlogin.repository.TransferRequestRepository;
import com.example.assetflowlogin.repository.UserRepository;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AssetTransferServiceImpl implements AssetTransferService {

    private final TransferRequestRepository transferRepository;
    private final AssetRepository assetRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional
    public TransferResponseDTO initiateTransfer(TransferRequestDTO dto, User sender) {
        Asset asset = assetRepository.findById(dto.assetId())
            .orElseThrow(() -> new AssetNotAvailableException("Asset not found with ID: " + dto.assetId()));

        // Reference to the target user without loading the full entity
        User targetUser = userRepository.getReferenceById(dto.targetUserId());

        TransferRequest transferRequest = TransferRequest.builder()
            .asset(asset)
            .fromUser(sender)
            .toUser(targetUser)
            .requestedBy(sender)
            .status(TransferStatus.PENDING)
            .remarks(dto.reason())
            .build();

        TransferRequest savedRequest = transferRepository.save(transferRequest);
        return mapToResponseDTO(savedRequest);
    }

    private TransferResponseDTO mapToResponseDTO(TransferRequest request) {
        return TransferResponseDTO.builder()
            .id(request.getId())
            .assetId(request.getAsset().getId())
            .assetName(request.getAsset().getName())
            .senderId(request.getFromUser().getId())
            .senderEmail(request.getFromUser().getEmail())
            .receiverId(request.getToUser().getId())
            .receiverEmail(request.getToUser().getEmail())
            .status(request.getStatus())
            .reason(request.getRemarks())
            .createdAt(LocalDateTime.now())
            .build();
    }
}
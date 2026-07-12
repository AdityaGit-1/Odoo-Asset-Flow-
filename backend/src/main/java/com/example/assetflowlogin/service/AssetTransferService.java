package com.example.assetflowlogin.service;

import com.example.assetflowlogin.dto.request.TransferRequestDTO;
import com.example.assetflowlogin.dto.response.TransferResponseDTO;
import com.example.assetflowlogin.entity.User;

public interface AssetTransferService {
    TransferResponseDTO initiateTransfer(TransferRequestDTO dto, User sender);
}
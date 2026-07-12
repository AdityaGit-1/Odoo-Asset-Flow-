package com.example.assetflowlogin.dto.request;

import jakarta.validation.constraints.NotNull;

public record TransferRequestDTO(
    @NotNull(message = "Asset ID is required")
    Long assetId,

    @NotNull(message = "Target user ID is required")
    Long targetUserId,

    String reason
) {}

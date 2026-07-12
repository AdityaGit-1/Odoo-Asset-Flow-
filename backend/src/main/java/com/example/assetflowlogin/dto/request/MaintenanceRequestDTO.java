package com.example.assetflowlogin.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record MaintenanceRequestDTO(
    @NotNull(message = "Asset ID is required")
    Long assetId,

    @NotBlank(message = "Description is required")
    String description,

    @NotBlank(message = "Priority level is required")
    String priority
) {}
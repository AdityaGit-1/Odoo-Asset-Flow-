package com.example.assetflowlogin.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

public record ResourceBookingRequestDTO(
    @NotNull(message = "Asset ID is required")
    Long assetId,

    @NotNull(message = "Start time is required")
    LocalDateTime startTime,

    @NotNull(message = "End time is required")
    LocalDateTime endTime,

    @NotBlank(message = "Purpose is required")
    String purpose
) {}
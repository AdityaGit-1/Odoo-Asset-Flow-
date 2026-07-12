package com.example.assetflowlogin.dto.response;

import lombok.*;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MaintenanceResponseDTO {
    private Long id;
    private Long assetId;
    private String assetName;
    private String description;
    private String priority;
    private String status;
    private LocalDateTime createdAt;
}
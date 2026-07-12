package com.example.assetflowlogin.dto.response;

import com.example.assetflowlogin.enums.AssetStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LifecycleHistoryResponse {

    private Long id;

    private Long assetId;

    private AssetStatus previousStatus;

    private AssetStatus newStatus;

    private String remarks;

    private LocalDateTime changedAt;
}
package com.example.assetflowlogin.dto.request;

import lombok.Data;
import java.time.LocalDate;

@Data
public class AssetAllocationRequestDTO {
    private Long assetId;
    private Long userId;
    private LocalDate expectedReturnDate;
}
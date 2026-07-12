package com.example.assetflowlogin.dto.response;

import com.example.assetflowlogin.enums.AssetCondition;
import com.example.assetflowlogin.enums.AssetStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AssetResponse {

    private Long id;

    private String assetTag;

    private String serialNumber;

    private String name;

    private Long categoryId;

    private String categoryName;

    private LocalDate acquisitionDate;

    private BigDecimal acquisitionCost;

    private AssetCondition condition;

    private String location;

    private AssetStatus status;

    private Boolean bookable;

    private String photoUrl;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
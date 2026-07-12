package com.example.assetflowlogin.dto.request;

import com.example.assetflowlogin.enums.AssetCondition;
import com.example.assetflowlogin.enums.AssetStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateAssetRequest {

    @NotBlank
    private String assetTag;

    @NotBlank
    private String serialNumber;

    @NotBlank
    private String name;

    @NotNull
    private Long categoryId;

    @NotNull
    private LocalDate acquisitionDate;

    @NotNull
    @PositiveOrZero
    private BigDecimal acquisitionCost;

    @NotNull
    private AssetCondition condition;

    @NotBlank
    private String location;

    @NotNull
    private AssetStatus status;

    @NotNull
    private Boolean bookable;

    private String photoUrl;
}
package com.example.assetflowlogin.dto.request;

import com.example.assetflowlogin.enums.AssetStatus;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateLifecycleStatusRequest {

    @NotNull
    private AssetStatus status;

    private String remarks;
}
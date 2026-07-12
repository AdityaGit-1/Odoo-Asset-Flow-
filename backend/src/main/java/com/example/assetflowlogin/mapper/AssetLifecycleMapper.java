package com.example.assetflowlogin.mapper;

import com.example.assetflowlogin.dto.response.LifecycleHistoryResponse;
import com.example.assetflowlogin.entity.AssetLifecycle;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class AssetLifecycleMapper {

    public LifecycleHistoryResponse toResponse(AssetLifecycle assetLifecycle) {
        LifecycleHistoryResponse response = new LifecycleHistoryResponse();
        response.setId(assetLifecycle.getId());
        response.setAssetId(assetLifecycle.getAsset().getId());
        response.setPreviousStatus(assetLifecycle.getPreviousStatus());
        response.setNewStatus(assetLifecycle.getNewStatus());
        response.setRemarks(assetLifecycle.getRemarks());
        response.setChangedAt(assetLifecycle.getChangedAt());
        return response;
    }

    public List<LifecycleHistoryResponse> toResponseList(List<AssetLifecycle> assetLifecycles) {
        return assetLifecycles.stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }
}
package com.example.assetflowlogin.service;

import com.example.assetflowlogin.entity.Asset;
import com.example.assetflowlogin.entity.AssetLifecycle;
import com.example.assetflowlogin.enums.AssetStatus;

import java.util.List;

public interface AssetLifecycleService {

    AssetLifecycle recordStatusChange(Asset asset, AssetStatus previousStatus, AssetStatus newStatus, String remarks);

    AssetLifecycle changeStatus(Long assetId, AssetStatus newStatus, String remarks);

    List<AssetLifecycle> getHistory(Long assetId);
}
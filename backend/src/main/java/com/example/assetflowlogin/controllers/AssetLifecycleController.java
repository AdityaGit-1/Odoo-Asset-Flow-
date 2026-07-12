package com.example.assetflowlogin.controllers;

import com.example.assetflowlogin.dto.request.UpdateLifecycleStatusRequest;
import com.example.assetflowlogin.dto.response.APIResponse;
import com.example.assetflowlogin.dto.response.LifecycleHistoryResponse;
import com.example.assetflowlogin.entity.AssetLifecycle;
import com.example.assetflowlogin.mapper.AssetLifecycleMapper;
import com.example.assetflowlogin.service.AssetLifecycleService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/lifecycle")
public class AssetLifecycleController {

    private final AssetLifecycleService assetLifecycleService;
    private final AssetLifecycleMapper assetLifecycleMapper;

    public AssetLifecycleController(AssetLifecycleService assetLifecycleService,
                                     AssetLifecycleMapper assetLifecycleMapper) {
        this.assetLifecycleService = assetLifecycleService;
        this.assetLifecycleMapper = assetLifecycleMapper;
    }

    @GetMapping("/{assetId}")
    public ResponseEntity<APIResponse<List<LifecycleHistoryResponse>>> getHistory(@PathVariable Long assetId) {
        List<AssetLifecycle> history = assetLifecycleService.getHistory(assetId);
        return ResponseEntity.ok(APIResponse.success(assetLifecycleMapper.toResponseList(history)));
    }

    @PatchMapping("/{assetId}/status")
    public ResponseEntity<APIResponse<LifecycleHistoryResponse>> updateStatus(@PathVariable Long assetId,
                                                                                @Valid @RequestBody UpdateLifecycleStatusRequest request) {
        AssetLifecycle updated = assetLifecycleService.changeStatus(assetId, request.getStatus(), request.getRemarks());
        return ResponseEntity.ok(APIResponse.success(assetLifecycleMapper.toResponse(updated)));
    }
}
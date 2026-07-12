package com.example.assetflowlogin.controller;

import com.example.assetflowlogin.dto.request.CreateAssetRequest;
import com.example.assetflowlogin.dto.request.UpdateAssetRequest;
import com.example.assetflowlogin.dto.request.UpdateAssetStatusRequest;
import com.example.assetflowlogin.dto.response.ApiResponse;
import com.example.assetflowlogin.dto.response.AssetResponse;
import com.example.assetflowlogin.entity.Asset;
import com.example.assetflowlogin.entity.AssetCategory;
import com.example.assetflowlogin.enums.AssetStatus;
import com.example.assetflowlogin.mapper.AssetMapper;
import com.example.assetflowlogin.service.AssetService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/assets")
public class AssetController {

    private final AssetService assetService;
    private final AssetMapper assetMapper;

    public AssetController(AssetService assetService, AssetMapper assetMapper) {
        this.assetService = assetService;
        this.assetMapper = assetMapper;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<AssetResponse>> create(@Valid @RequestBody CreateAssetRequest request) {
        Asset asset = assetMapper.toEntity(request);

        AssetCategory category = new AssetCategory();
        category.setId(request.getCategoryId());
        asset.setCategory(category);

        Asset created = assetService.create(asset);
        return ResponseEntity.ok(ApiResponse.success(assetMapper.toResponse(created)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<AssetResponse>> update(@PathVariable Long id,
                                                              @Valid @RequestBody UpdateAssetRequest request) {
        Asset asset = new Asset();
        assetMapper.updateEntity(request, asset);

        AssetCategory category = new AssetCategory();
        category.setId(request.getCategoryId());
        asset.setCategory(category);

        Asset updated = assetService.update(id, asset);
        return ResponseEntity.ok(ApiResponse.success(assetMapper.toResponse(updated)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        assetService.delete(id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<AssetResponse>> getById(@PathVariable Long id) {
        Asset asset = assetService.getById(id);
        return ResponseEntity.ok(ApiResponse.success(assetMapper.toResponse(asset)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<AssetResponse>>> getAll() {
        List<Asset> assets = assetService.getAll();
        return ResponseEntity.ok(ApiResponse.success(assetMapper.toResponseList(assets)));
    }

    @GetMapping("/tag/{assetTag}")
    public ResponseEntity<ApiResponse<AssetResponse>> getByAssetTag(@PathVariable String assetTag) {
        Optional<Asset> asset = assetService.getByAssetTag(assetTag);
        return asset.map(value -> ResponseEntity.ok(ApiResponse.success(assetMapper.toResponse(value))))
                .orElseGet(() -> ResponseEntity.ok(ApiResponse.error("Asset not found with assetTag: " + assetTag)));
    }

    @GetMapping("/status/{status}")
    public ResponseEntity<ApiResponse<List<AssetResponse>>> getByStatus(@PathVariable AssetStatus status) {
        List<Asset> assets = assetService.getByStatus(status);
        return ResponseEntity.ok(ApiResponse.success(assetMapper.toResponseList(assets)));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<ApiResponse<AssetResponse>> updateStatus(@PathVariable Long id,
                                                                    @Valid @RequestBody UpdateAssetStatusRequest request) {
        Asset updated = assetService.updateStatus(id, request.getStatus());
        return ResponseEntity.ok(ApiResponse.success(assetMapper.toResponse(updated)));
    }

    @GetMapping("/{id}/exists")
    public ResponseEntity<ApiResponse<Boolean>> exists(@PathVariable Long id) {
        boolean exists = assetService.exists(id);
        return ResponseEntity.ok(ApiResponse.success(exists));
    }
}
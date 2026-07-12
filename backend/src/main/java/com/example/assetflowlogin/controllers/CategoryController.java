package com.example.assetflowlogin.controllers;

import com.example.assetflowlogin.dto.response.APIResponse;
import com.example.assetflowlogin.entity.AssetCategory;
import com.example.assetflowlogin.repository.AssetCategoryRepository;
import com.example.assetflowlogin.security.SecurityUtils;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Asset categories. customFields aren't persisted by this backend, so they are
 * always returned as an empty map — the register form then shows no custom
 * inputs, which is the correct graceful degradation.
 */
@RestController
@RequestMapping("/api/categories")
public class CategoryController {

    private final AssetCategoryRepository categories;

    public CategoryController(AssetCategoryRepository categories) {
        this.categories = categories;
    }

    public record CategoryDto(Long id, String name, String description,
                              Map<String, String> customFields, boolean isActive,
                              LocalDateTime createdAt) {
        static CategoryDto of(AssetCategory c) {
            return new CategoryDto(c.getId(), c.getName(), c.getDescription(),
                    Map.of(), c.isActive(), c.getCreatedAt());
        }
    }

    public record UpsertCategory(@NotBlank String name, String description,
                                 Map<String, String> customFields) {}

    public record StatusChange(Boolean isActive) {}

    @GetMapping
    public ResponseEntity<APIResponse<List<CategoryDto>>> list() {
        return ResponseEntity.ok(APIResponse.success(
                categories.findAll().stream().map(CategoryDto::of).toList()));
    }

    private <T> ResponseEntity<APIResponse<T>> forbidden() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(APIResponse.error("You don't have access to this action"));
    }

    @PostMapping
    public ResponseEntity<APIResponse<CategoryDto>> create(@RequestBody UpsertCategory req) {
        if (!SecurityUtils.isAdmin()) return forbidden();
        if (req.name() == null || req.name().isBlank())
            return ResponseEntity.ok(APIResponse.error("Category name is required"));
        if (categories.existsByName(req.name().trim()))
            return ResponseEntity.ok(APIResponse.error("A category named \"" + req.name().trim() + "\" already exists"));
        AssetCategory c = new AssetCategory();
        c.setName(req.name().trim());
        c.setDescription(req.description());
        c.setActive(true);
        return ResponseEntity.ok(APIResponse.success(CategoryDto.of(categories.save(c))));
    }

    @PutMapping("/{id}")
    public ResponseEntity<APIResponse<CategoryDto>> update(@PathVariable Long id, @RequestBody UpsertCategory req) {
        if (!SecurityUtils.isAdmin()) return forbidden();
        return categories.findById(id).map(c -> {
            if (req.name() != null && !req.name().isBlank()) c.setName(req.name().trim());
            if (req.description() != null) c.setDescription(req.description());
            return ResponseEntity.ok(APIResponse.success(CategoryDto.of(categories.save(c))));
        }).orElseGet(() -> ResponseEntity.ok(APIResponse.error("Category not found")));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<APIResponse<CategoryDto>> setStatus(@PathVariable Long id, @RequestBody StatusChange req) {
        if (!SecurityUtils.isAdmin()) return forbidden();
        return categories.findById(id).map(c -> {
            c.setActive(Boolean.TRUE.equals(req.isActive()));
            return ResponseEntity.ok(APIResponse.success(CategoryDto.of(categories.save(c))));
        }).orElseGet(() -> ResponseEntity.ok(APIResponse.error("Category not found")));
    }
}

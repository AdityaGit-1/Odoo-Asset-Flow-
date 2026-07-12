package com.example.assetflowlogin.controllers;

import com.example.assetflowlogin.dto.response.APIResponse;
import com.example.assetflowlogin.entity.Department;
import com.example.assetflowlogin.enums.UserStatus;
import com.example.assetflowlogin.repository.DepartmentRepository;
import com.example.assetflowlogin.security.SecurityUtils;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Departments CRUD. The domain model is flat (no parent hierarchy or head
 * assignment), so those fields are returned null — the frontend renders them as
 * "None"/"Unassigned" and its pickers simply stay empty.
 */
@RestController
@RequestMapping("/api/departments")
public class DepartmentController {

    private final DepartmentRepository departments;

    public DepartmentController(DepartmentRepository departments) {
        this.departments = departments;
    }

    public record DepartmentDto(Long id, String name, String description,
                                Long parentDepartmentId, Long headEmployeeId,
                                String status, LocalDateTime createdAt) {
        static DepartmentDto of(Department d) {
            return new DepartmentDto(d.getId(), d.getName(), d.getDescription(),
                    null, null,
                    d.getStatus() == UserStatus.ACTIVE ? "ACTIVE" : "INACTIVE",
                    d.getCreatedAt());
        }
    }

    public record UpsertDepartment(@NotBlank String name, String description,
                                   Long parentDepartmentId, Long headEmployeeId) {}

    public record StatusChange(String status) {}

    @GetMapping
    public ResponseEntity<APIResponse<List<DepartmentDto>>> list() {
        return ResponseEntity.ok(APIResponse.success(
                departments.findAll().stream().map(DepartmentDto::of).toList()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<APIResponse<DepartmentDto>> get(@PathVariable Long id) {
        return departments.findById(id)
                .map(d -> ResponseEntity.ok(APIResponse.success(DepartmentDto.of(d))))
                .orElseGet(() -> ResponseEntity.ok(APIResponse.error("Department not found")));
    }

    private <T> ResponseEntity<APIResponse<T>> forbidden() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(APIResponse.error("You don't have access to this action"));
    }

    @PostMapping
    public ResponseEntity<APIResponse<DepartmentDto>> create(@RequestBody UpsertDepartment req) {
        if (!SecurityUtils.isAdmin()) return forbidden();
        if (req.name() == null || req.name().isBlank())
            return ResponseEntity.ok(APIResponse.error("Department name is required"));
        Department d = new Department();
        d.setName(req.name().trim());
        d.setDescription(req.description());
        d.setStatus(UserStatus.ACTIVE);
        return ResponseEntity.ok(APIResponse.success(DepartmentDto.of(departments.save(d))));
    }

    @PutMapping("/{id}")
    public ResponseEntity<APIResponse<DepartmentDto>> update(@PathVariable Long id, @RequestBody UpsertDepartment req) {
        if (!SecurityUtils.isAdmin()) return forbidden();
        return departments.findById(id).map(d -> {
            if (req.name() != null && !req.name().isBlank()) d.setName(req.name().trim());
            if (req.description() != null) d.setDescription(req.description());
            return ResponseEntity.ok(APIResponse.success(DepartmentDto.of(departments.save(d))));
        }).orElseGet(() -> ResponseEntity.ok(APIResponse.error("Department not found")));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<APIResponse<DepartmentDto>> setStatus(@PathVariable Long id, @RequestBody StatusChange req) {
        if (!SecurityUtils.isAdmin()) return forbidden();
        return departments.findById(id).map(d -> {
            d.setStatus("INACTIVE".equalsIgnoreCase(req.status()) ? UserStatus.INACTIVE : UserStatus.ACTIVE);
            return ResponseEntity.ok(APIResponse.success(DepartmentDto.of(departments.save(d))));
        }).orElseGet(() -> ResponseEntity.ok(APIResponse.error("Department not found")));
    }
}

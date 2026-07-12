package com.example.assetflowlogin.controllers;

import com.example.assetflowlogin.dto.response.APIResponse;
import com.example.assetflowlogin.entity.Role;
import com.example.assetflowlogin.entity.User;
import com.example.assetflowlogin.enums.Rolename;
import com.example.assetflowlogin.enums.UserStatus;
import com.example.assetflowlogin.repository.DepartmentRepository;
import com.example.assetflowlogin.repository.RoleRepository;
import com.example.assetflowlogin.repository.UserRepository;
import com.example.assetflowlogin.security.SecurityUtils;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * The employee directory is the User table joined to its roles. This is the
 * only place roles change. A user's many roles are collapsed to one "primary"
 * role (highest privilege) for the directory display and dropdown.
 */
@RestController
@RequestMapping("/api/employees")
public class EmployeeController {

    private final UserRepository users;
    private final RoleRepository roles;
    private final DepartmentRepository departments;

    public EmployeeController(UserRepository users, RoleRepository roles, DepartmentRepository departments) {
        this.users = users;
        this.roles = roles;
        this.departments = departments;
    }

    // Highest privilege first — the one shown/edited in the directory.
    private static final List<Rolename> PRECEDENCE =
            List.of(Rolename.ADMIN, Rolename.ASSET_MANAGER, Rolename.DEPARTMENT_HEAD, Rolename.TECHNICIAN, Rolename.EMPLOYEE);

    private static Rolename primaryRole(User u) {
        return PRECEDENCE.stream().filter(r -> u.getRoles().stream().anyMatch(x -> x.getName() == r))
                .findFirst().orElse(Rolename.EMPLOYEE);
    }

    public record EmployeeDto(Long id, Long userId, String name, String email,
                              Long departmentId, String status, String role) {
        static EmployeeDto of(User u) {
            String name = (u.getFirstName() + " " + (u.getLastName() == null ? "" : u.getLastName())).trim();
            return new EmployeeDto(u.getId(), u.getId(), name, u.getEmail(),
                    u.getDepartment() == null ? null : u.getDepartment().getId(),
                    u.getStatus() == UserStatus.ACTIVE ? "ACTIVE" : "INACTIVE",
                    primaryRole(u).name());
        }
    }

    public record DepartmentChange(Long departmentId) {}
    public record StatusChange(String status) {}
    public record RoleChange(String newRole) {}

    @GetMapping
    public ResponseEntity<APIResponse<List<EmployeeDto>>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Long department,
            @RequestParam(required = false) String role) {
        List<EmployeeDto> rows = users.findAll().stream()
                .map(EmployeeDto::of)
                .filter(e -> q == null || q.isBlank()
                        || e.name().toLowerCase().contains(q.toLowerCase())
                        || e.email().toLowerCase().contains(q.toLowerCase()))
                .filter(e -> department == null || department.equals(e.departmentId()))
                .filter(e -> role == null || role.isBlank() || role.equals(e.role()))
                .toList();
        return ResponseEntity.ok(APIResponse.success(rows));
    }

    @GetMapping("/{id}")
    public ResponseEntity<APIResponse<EmployeeDto>> get(@PathVariable Long id) {
        return users.findById(id)
                .map(u -> ResponseEntity.ok(APIResponse.success(EmployeeDto.of(u))))
                .orElseGet(() -> ResponseEntity.ok(APIResponse.error("Employee not found")));
    }

    private <T> ResponseEntity<APIResponse<T>> forbidden() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(APIResponse.error("You don't have access to this action"));
    }

    @PatchMapping("/{id}/department")
    public ResponseEntity<APIResponse<EmployeeDto>> setDepartment(@PathVariable Long id, @RequestBody DepartmentChange req) {
        if (!SecurityUtils.isAdmin()) return forbidden();
        return users.findById(id).map(u -> {
            u.setDepartment(req.departmentId() == null ? null : departments.findById(req.departmentId()).orElse(null));
            return ResponseEntity.ok(APIResponse.success(EmployeeDto.of(users.save(u))));
        }).orElseGet(() -> ResponseEntity.ok(APIResponse.error("Employee not found")));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<APIResponse<EmployeeDto>> setStatus(@PathVariable Long id, @RequestBody StatusChange req) {
        if (!SecurityUtils.isAdmin()) return forbidden();
        return users.findById(id).map(u -> {
            boolean active = !"INACTIVE".equalsIgnoreCase(req.status());
            u.setStatus(active ? UserStatus.ACTIVE : UserStatus.INACTIVE);
            u.setEnabled(active);
            return ResponseEntity.ok(APIResponse.success(EmployeeDto.of(users.save(u))));
        }).orElseGet(() -> ResponseEntity.ok(APIResponse.error("Employee not found")));
    }

    @PatchMapping("/{id}/role")
    @Transactional
    public ResponseEntity<APIResponse<Void>> setRole(@PathVariable Long id, @RequestBody RoleChange req) {
        if (!SecurityUtils.isAdmin()) return forbidden();          // the only writer of elevated roles
        User target = users.findById(id).orElse(null);
        if (target == null) return ResponseEntity.ok(APIResponse.error("Employee not found"));

        Rolename newRole;
        try {
            newRole = Rolename.valueOf(req.newRole());
        } catch (IllegalArgumentException | NullPointerException e) {
            return ResponseEntity.ok(APIResponse.error("Unknown role"));
        }

        // Don't demote the only remaining admin — or you lock everyone out.
        boolean targetIsAdmin = target.getRoles().stream().anyMatch(r -> r.getName() == Rolename.ADMIN);
        if (targetIsAdmin && newRole != Rolename.ADMIN) {
            long admins = users.findAll().stream()
                    .filter(u -> u.getStatus() == UserStatus.ACTIVE)
                    .filter(u -> u.getRoles().stream().anyMatch(r -> r.getName() == Rolename.ADMIN))
                    .count();
            if (admins <= 1)
                return ResponseEntity.ok(APIResponse.error(
                        "Cannot demote the only remaining admin — promote someone else to Admin first"));
        }

        Role role = roles.findByName(newRole).orElse(null);
        if (role == null) return ResponseEntity.ok(APIResponse.error("Role " + newRole + " is not configured"));
        target.setRoles(new HashSet<>(Set.of(role)));   // mutable — Hibernate manages the collection
        users.save(target);
        return ResponseEntity.ok(APIResponse.success(null));
    }
}

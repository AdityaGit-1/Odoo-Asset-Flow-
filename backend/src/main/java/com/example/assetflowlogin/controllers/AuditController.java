package com.example.assetflowlogin.controllers;

import com.example.assetflowlogin.dto.response.APIResponse;
import com.example.assetflowlogin.entity.*;
import com.example.assetflowlogin.enums.AssetStatus;
import com.example.assetflowlogin.enums.AuditStatus;
import com.example.assetflowlogin.repository.*;
import com.example.assetflowlogin.security.SecurityUtils;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Audit cycles. The backend has no pre-snapshot table, so the checklist is
 * derived on read: every in-scope asset, left-joined to any AuditRecord already
 * marked for the cycle (result null = unchecked). Marking upserts a record.
 * Closing sets confirmed-missing assets to LOST.
 */
@RestController
@RequestMapping("/api/audits")
public class AuditController {

    private final AuditCycleRepository cycles;
    private final AuditRecordRepository records;
    private final AssetRepository assets;
    private final DepartmentRepository departments;
    private final UserRepository users;

    public AuditController(AuditCycleRepository cycles, AuditRecordRepository records,
                           AssetRepository assets, DepartmentRepository departments, UserRepository users) {
        this.cycles = cycles;
        this.records = records;
        this.assets = assets;
        this.departments = departments;
        this.users = users;
    }

    // ---- DTOs (shapes match the frontend's AuditCycle / AuditItem) ----

    public record CycleDto(Long id, String name, Long scopeDepartmentId, String scopeDepartmentName,
                           String scopeLocation, LocalDate startDate, LocalDate endDate, String status,
                           Long createdBy, String createdByName, LocalDateTime createdAt, LocalDateTime closedAt,
                           List<Long> auditorIds, List<String> auditorNames, Progress progress) {}

    public record Progress(int checked, int total) {}

    public record AssetRef(Long id, String assetTag, String name, String location, String status) {}

    public record ItemDto(Long id, Long cycleId, Long assetId, AssetRef asset, String result,
                          Long auditorId, String auditorName, String notes, LocalDateTime checkedAt) {}

    public record CreateCycle(String name, Long scopeDepartmentId, String scopeLocation,
                              LocalDate startDate, LocalDate endDate) {}

    public record AssignAuditors(List<Long> auditorIds) {}

    public record Mark(String result, String notes) {}

    // ---- helpers ----

    private String auditorName(Long id) {
        return users.findById(id).map(u -> (u.getFirstName() + " " + (u.getLastName() == null ? "" : u.getLastName())).trim())
                .orElse("Unknown");
    }

    private List<Asset> inScope(AuditCycle c) {
        String loc = c.getLocation();
        String deptName = c.getDepartment() == null ? null : c.getDepartment().getName();
        return assets.findAll().stream()
                .filter(a -> a.getStatus() != AssetStatus.RETIRED)
                .filter(a -> {
                    if ((loc == null || loc.isBlank()) && deptName == null) return true;
                    String al = a.getLocation() == null ? "" : a.getLocation().toLowerCase();
                    boolean byLoc = loc != null && !loc.isBlank() && al.contains(loc.toLowerCase());
                    boolean byDept = deptName != null && al.contains(deptName.toLowerCase());
                    return byLoc || byDept;
                })
                .toList();
    }

    private CycleDto toDto(AuditCycle c) {
        List<AuditRecord> recs = records.findByAuditCycleId(c.getId());
        int total = inScope(c).size();
        long checked = recs.stream().map(r -> r.getAsset().getId()).distinct().count();
        List<Long> auditorIds = new ArrayList<>(c.getAuditorIds());
        return new CycleDto(
                c.getId(), c.getName(),
                c.getDepartment() == null ? null : c.getDepartment().getId(),
                c.getDepartment() == null ? null : c.getDepartment().getName(),
                c.getLocation(), c.getStartDate(), c.getEndDate(),
                c.getStatus() == null ? "OPEN" : c.getStatus(),
                null, null, c.getCreatedAt(),
                "CLOSED".equals(c.getStatus()) ? c.getUpdatedAt() : null,
                auditorIds, auditorIds.stream().map(this::auditorName).toList(),
                new Progress((int) checked, total));
    }

    // ---- endpoints ----

    @GetMapping
    public ResponseEntity<APIResponse<List<CycleDto>>> list() {
        List<CycleDto> out = cycles.findAll().stream()
                .sorted(Comparator.comparing(AuditCycle::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::toDto).toList();
        return ResponseEntity.ok(APIResponse.success(out));
    }

    @GetMapping("/{id}")
    public ResponseEntity<APIResponse<CycleDto>> get(@PathVariable Long id) {
        return cycles.findById(id).map(c -> ResponseEntity.ok(APIResponse.success(toDto(c))))
                .orElseGet(() -> ResponseEntity.ok(APIResponse.error("Audit cycle not found")));
    }

    private <T> ResponseEntity<APIResponse<T>> forbidden() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(APIResponse.error("Only admins can manage audit cycles"));
    }

    @PostMapping
    public ResponseEntity<APIResponse<CycleDto>> create(@RequestBody CreateCycle req) {
        if (!SecurityUtils.isAdmin()) return forbidden();
        if (req.name() == null || req.name().isBlank())
            return ResponseEntity.ok(APIResponse.error("Name is required"));
        if (req.startDate() == null || req.endDate() == null || req.startDate().isAfter(req.endDate()))
            return ResponseEntity.ok(APIResponse.error("Start date must be on or before the end date"));
        AuditCycle c = new AuditCycle();
        c.setName(req.name().trim());
        c.setLocation(req.scopeLocation() == null || req.scopeLocation().isBlank() ? null : req.scopeLocation().trim());
        if (req.scopeDepartmentId() != null) c.setDepartment(departments.findById(req.scopeDepartmentId()).orElse(null));
        c.setStartDate(req.startDate());
        c.setEndDate(req.endDate());
        c.setStatus("OPEN");
        AuditCycle saved = cycles.save(c);
        if (inScope(saved).isEmpty())
            return ResponseEntity.ok(APIResponse.error("No assets match that scope — widen the department/location"));
        return ResponseEntity.ok(APIResponse.success(toDto(saved)));
    }

    @PostMapping("/{id}/auditors")
    public ResponseEntity<APIResponse<CycleDto>> assignAuditors(@PathVariable Long id, @RequestBody AssignAuditors req) {
        if (!SecurityUtils.isAdmin()) return forbidden();
        return cycles.findById(id).map(c -> {
            if ("CLOSED".equals(c.getStatus())) return ResponseEntity.ok(APIResponse.<CycleDto>error("This cycle is closed"));
            c.setAuditorIds(new HashSet<>(req.auditorIds() == null ? List.of() : req.auditorIds()));
            return ResponseEntity.ok(APIResponse.success(toDto(cycles.save(c))));
        }).orElseGet(() -> ResponseEntity.ok(APIResponse.error("Audit cycle not found")));
    }

    @GetMapping("/{id}/items")
    public ResponseEntity<APIResponse<List<ItemDto>>> items(@PathVariable Long id) {
        AuditCycle c = cycles.findById(id).orElse(null);
        if (c == null) return ResponseEntity.ok(APIResponse.error("Audit cycle not found"));
        Map<Long, AuditRecord> byAsset = new HashMap<>();
        for (AuditRecord r : records.findByAuditCycleId(id)) byAsset.put(r.getAsset().getId(), r);
        List<ItemDto> out = inScope(c).stream().map(a -> {
            AuditRecord r = byAsset.get(a.getId());
            return new ItemDto(
                    r == null ? a.getId() : r.getId(), id, a.getId(),
                    new AssetRef(a.getId(), a.getAssetTag(), a.getName(), a.getLocation(), a.getStatus().name()),
                    r == null ? null : r.getStatus().name(),
                    r == null || r.getAuditor() == null ? null : r.getAuditor().getId(),
                    r == null || r.getAuditor() == null ? null : auditorName(r.getAuditor().getId()),
                    r == null ? null : r.getRemarks(),
                    r == null ? null : r.getUpdatedAt());
        }).toList();
        return ResponseEntity.ok(APIResponse.success(out));
    }

    @PatchMapping("/{id}/items/{assetId}")
    @Transactional
    public ResponseEntity<APIResponse<ItemDto>> mark(@PathVariable Long id, @PathVariable Long assetId, @RequestBody Mark req) {
        AuditCycle c = cycles.findById(id).orElse(null);
        if (c == null) return ResponseEntity.ok(APIResponse.error("Audit cycle not found"));
        if ("CLOSED".equals(c.getStatus()))
            return ResponseEntity.ok(APIResponse.error("This cycle is closed — results are locked"));

        Long me = SecurityUtils.getCurrentUserId();
        if (!c.getAuditorIds().isEmpty() && !c.getAuditorIds().contains(me))
            return ResponseEntity.ok(APIResponse.error("Only assigned auditors can record results"));

        AuditStatus result;
        try {
            result = AuditStatus.valueOf(req.result());
        } catch (IllegalArgumentException | NullPointerException e) {
            return ResponseEntity.ok(APIResponse.error("Pick a result"));
        }
        Asset asset = assets.findById(assetId).orElse(null);
        if (asset == null) return ResponseEntity.ok(APIResponse.error("That asset isn't in this cycle"));

        AuditRecord rec = records.findByAuditCycleId(id).stream()
                .filter(r -> r.getAsset().getId().equals(assetId)).findFirst().orElseGet(AuditRecord::new);
        rec.setAuditCycle(c);
        rec.setAsset(asset);
        rec.setAuditor(users.findById(me).orElseThrow());
        rec.setStatus(result);
        rec.setRemarks(req.notes());
        AuditRecord saved = records.save(rec);
        return ResponseEntity.ok(APIResponse.success(new ItemDto(
                saved.getId(), id, assetId,
                new AssetRef(asset.getId(), asset.getAssetTag(), asset.getName(), asset.getLocation(), asset.getStatus().name()),
                saved.getStatus().name(), me, auditorName(me), saved.getRemarks(), saved.getUpdatedAt())));
    }

    @GetMapping("/{id}/discrepancies")
    public ResponseEntity<APIResponse<List<ItemDto>>> discrepancies(@PathVariable Long id) {
        List<ItemDto> out = records.findByAuditCycleId(id).stream()
                .filter(r -> r.getStatus() == AuditStatus.MISSING || r.getStatus() == AuditStatus.DAMAGED)
                .map(r -> new ItemDto(r.getId(), id, r.getAsset().getId(),
                        new AssetRef(r.getAsset().getId(), r.getAsset().getAssetTag(), r.getAsset().getName(),
                                r.getAsset().getLocation(), r.getAsset().getStatus().name()),
                        r.getStatus().name(),
                        r.getAuditor() == null ? null : r.getAuditor().getId(),
                        r.getAuditor() == null ? null : auditorName(r.getAuditor().getId()),
                        r.getRemarks(), r.getUpdatedAt()))
                .toList();
        return ResponseEntity.ok(APIResponse.success(out));
    }

    @PatchMapping("/{id}/close")
    @Transactional
    public ResponseEntity<APIResponse<CycleDto>> close(@PathVariable Long id) {
        if (!SecurityUtils.isAdmin()) return forbidden();
        AuditCycle c = cycles.findById(id).orElse(null);
        if (c == null) return ResponseEntity.ok(APIResponse.error("Audit cycle not found"));
        if ("CLOSED".equals(c.getStatus())) return ResponseEntity.ok(APIResponse.error("This cycle is already closed"));
        // Confirmed-missing assets become LOST (direct write; the lifecycle service
        // isn't reused here to keep the close self-contained).
        for (AuditRecord r : records.findByAuditCycleId(id)) {
            if (r.getStatus() == AuditStatus.MISSING) {
                Asset a = r.getAsset();
                if (a.getStatus() != AssetStatus.RETIRED) {
                    a.setStatus(AssetStatus.LOST);
                    assets.save(a);
                }
            }
        }
        c.setStatus("CLOSED");
        return ResponseEntity.ok(APIResponse.success(toDto(cycles.save(c))));
    }
}

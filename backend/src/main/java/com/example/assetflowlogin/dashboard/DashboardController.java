package com.example.assetflowlogin.dashboard;

import com.example.assetflowlogin.entity.AssetAllocation;
import com.example.assetflowlogin.entity.TransferRequest;
import com.example.assetflowlogin.entity.User;
import com.example.assetflowlogin.enums.Rolename;
import com.example.assetflowlogin.repository.*;
import com.example.assetflowlogin.security.SecurityUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Role-scoped KPI bundle + "needs attention" list, in the shape the frontend
 * dashboard expects. Computed from the JPA repositories rather than the
 * hand-written raw SQL, which targeted a different (brief) schema.
 */
@RestController
public class DashboardController {

    private final AssetRepository assets;
    private final AssetAllocationRepository allocations;
    private final ResourceBookingRepository bookings;
    private final MaintainenceRequestRepository maintenance;
    private final TransferRequestRepository transfers;

    public DashboardController(AssetRepository assets, AssetAllocationRepository allocations,
                               ResourceBookingRepository bookings, MaintainenceRequestRepository maintenance,
                               TransferRequestRepository transfers) {
        this.assets = assets;
        this.allocations = allocations;
        this.bookings = bookings;
        this.maintenance = maintenance;
        this.transfers = transfers;
    }

    public record Kpis(long assetsAvailable, long assetsAllocated, long maintenanceToday, long activeBookings,
                       long pendingTransfers, long upcomingReturns, long overdueReturns) {}

    public record Attention(String id, String kind, String message, String detail, String href, String at) {}

    public record Dashboard(String scope, Kpis kpis, List<Attention> needsAttention) {}

    private static final Set<String> ACTIVE_BOOKING = Set.of("UPCOMING", "ONGOING");
    private static final Set<String> IN_FLIGHT_MAINT = Set.of("APPROVED", "TECHNICIAN_ASSIGNED", "IN_PROGRESS");

    private static String s(Object status) {
        return status == null ? "" : status.toString();
    }

    @GetMapping("/api/dashboard")
    public Dashboard dashboard() {
        User u = SecurityUtils.getCurrentUser().getUser();
        boolean manager = SecurityUtils.isManager();
        boolean head = SecurityUtils.hasRole(Rolename.DEPARTMENT_HEAD);
        String scope = manager ? "ORG" : head ? "DEPARTMENT" : "SELF";
        Long userId = u.getId();
        Long deptId = u.getDepartment() == null ? null : u.getDepartment().getId();

        LocalDate today = LocalDate.now();
        LocalDate weekOut = today.plusDays(7);

        List<AssetAllocation> active = allocations.findAll().stream()
                .filter(a -> "ACTIVE".equals(s(a.getStatus())) || "OVERDUE".equals(s(a.getStatus())))
                .filter(a -> switch (scope) {
                    case "ORG" -> true;
                    case "SELF" -> a.getUser() != null && a.getUser().getId().equals(userId);
                    default -> a.getUser() != null && a.getUser().getDepartment() != null
                            && a.getUser().getDepartment().getId().equals(deptId);
                })
                .toList();

        List<AssetAllocation> overdue = active.stream()
                .filter(a -> a.getExpectedReturnDate() != null && a.getExpectedReturnDate().isBefore(today)).toList();
        long upcoming = active.stream()
                .filter(a -> a.getExpectedReturnDate() != null
                        && !a.getExpectedReturnDate().isBefore(today) && !a.getExpectedReturnDate().isAfter(weekOut)).count();

        long availableAssets = assets.findAll().stream().filter(a -> "AVAILABLE".equals(s(a.getStatus()))).count();
        long allocatedAssets = scope.equals("ORG")
                ? assets.findAll().stream().filter(a -> "ALLOCATED".equals(s(a.getStatus()))).count()
                : active.size();
        long maintToday = maintenance.findAll().stream().filter(m -> IN_FLIGHT_MAINT.contains(s(m.getStatus()))).count();
        long activeBookings = bookings.findAll().stream().filter(b -> ACTIVE_BOOKING.contains(s(b.getStatus()))).count();
        List<TransferRequest> pending = transfers.findAll().stream()
                .filter(t -> "PENDING".equals(s(t.getStatus())) || "REQUESTED".equals(s(t.getStatus()))).toList();

        Kpis kpis = new Kpis(availableAssets, allocatedAssets, maintToday, activeBookings,
                pending.size(), upcoming, overdue.size());

        List<Attention> attention = new ArrayList<>();
        for (AssetAllocation a : overdue.stream().limit(4).toList()) {
            long days = Math.max(1, today.toEpochDay() - a.getExpectedReturnDate().toEpochDay());
            String tag = a.getAsset() == null ? "Asset" : a.getAsset().getAssetTag();
            attention.add(new Attention("ov-" + a.getId(), "OVERDUE",
                    tag + " — " + days + " day" + (days > 1 ? "s" : "") + " overdue",
                    a.getUser() == null ? null : "Held by " + a.getUser().getFirstName(),
                    "/allocations", a.getExpectedReturnDate().toString()));
        }
        if (!scope.equals("SELF")) {
            for (TransferRequest t : pending.stream().limit(3).toList()) {
                String tag = t.getAsset() == null ? "Asset" : t.getAsset().getAssetTag();
                attention.add(new Attention("tr-" + t.getId(), "TRANSFER_PENDING",
                        "Transfer awaiting approval: " + tag, null, "/allocations?tab=transfers", null));
            }
        }
        if (manager) {
            maintenance.findAll().stream().filter(m -> "PENDING".equals(s(m.getStatus()))).limit(3).forEach(m -> {
                String tag = m.getAsset() == null ? "Asset" : m.getAsset().getAssetTag();
                attention.add(new Attention("mt-" + m.getId(), "MAINT_PENDING",
                        "Maintenance awaiting approval: " + tag, null, "/maintenance", null));
            });
        }

        return new Dashboard(scope, kpis, attention);
    }
}

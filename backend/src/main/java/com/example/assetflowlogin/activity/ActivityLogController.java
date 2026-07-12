package com.example.assetflowlogin.activity;

import com.example.assetflowlogin.repository.UserRepository;
import com.example.assetflowlogin.security.SecurityUtils;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;

/**
 * Activity log for admins/managers. Filtering is done in Java — the repository's
 * `:param IS NULL OR …` query fails Postgres type inference when the params are
 * null (the common no-filter case).
 */
@RestController
@RequestMapping("/api/activity")
public class ActivityLogController {

    private final ActivityLogRepository repository;
    private final UserRepository users;

    public ActivityLogController(ActivityLogRepository repository, UserRepository users) {
        this.repository = repository;
        this.users = users;
    }

    public record ActivityDto(Long id, Long actorId, String actorName, String action,
                              String entityType, Long entityId, String detail, OffsetDateTime createdAt) {}

    @GetMapping
    public ResponseEntity<List<ActivityDto>> search(
            @RequestParam(name = "actor", required = false) Long actor,
            @RequestParam(name = "entity", required = false) String entityType,
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) @RequestParam(required = false) OffsetDateTime from,
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) @RequestParam(required = false) OffsetDateTime to) {

        if (!SecurityUtils.isManager()) return ResponseEntity.status(HttpStatus.FORBIDDEN).build();

        List<ActivityDto> rows = repository.findAll().stream()
                .filter(a -> actor == null || actor.equals(a.getActorId()))
                .filter(a -> entityType == null || entityType.isBlank() || entityType.equals(a.getEntityType()))
                .filter(a -> from == null || (a.getCreatedAt() != null && !a.getCreatedAt().isBefore(from)))
                .filter(a -> to == null || (a.getCreatedAt() != null && !a.getCreatedAt().isAfter(to)))
                .sorted(Comparator.comparing(ActivityLog::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(200)
                .map(a -> new ActivityDto(a.getId(), a.getActorId(), actorName(a.getActorId()), a.getAction(),
                        a.getEntityType(), a.getEntityId(), a.getDetail(), a.getCreatedAt()))
                .toList();
        return ResponseEntity.ok(rows);
    }

    private String actorName(Long id) {
        if (id == null) return "System";
        return users.findById(id)
                .map(u -> (u.getFirstName() + " " + (u.getLastName() == null ? "" : u.getLastName())).trim())
                .orElse("System");
    }
}

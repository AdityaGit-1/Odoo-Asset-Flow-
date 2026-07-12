package com.example.assetflowlogin.notification;

import com.example.assetflowlogin.security.SecurityUtils;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationRepository repository;

    // Optional SSE fan-out: one emitter list per recipient, in-memory only
    // (fine for a single-instance deploy).
    private final Map<Long, CopyOnWriteArrayList<SseEmitter>> emittersByRecipient = new ConcurrentHashMap<>();

    public NotificationController(NotificationRepository repository) {
        this.repository = repository;
    }

    // GET /api/notifications -> caller's notifications (unread first)
    @GetMapping
    public List<Notification> list(Authentication auth) {
        Long recipientId = SecurityUtils.getCurrentUserId();
        return repository.findForRecipientUnreadFirst(recipientId);
    }

    // PATCH /api/notifications/{id}/read -> mark read
    @PatchMapping("/{id}/read")
    public ResponseEntity<Void> markRead(@PathVariable Long id, Authentication auth) {
        Long recipientId = SecurityUtils.getCurrentUserId();
        return repository.findById(id)
                .filter(n -> n.getRecipientId().equals(recipientId))
                .map(n -> {
                    n.markRead();
                    repository.save(n);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // GET /api/notifications/stream -> optional SSE for live push
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(Authentication auth) {
        Long recipientId = SecurityUtils.getCurrentUserId();
        SseEmitter emitter = new SseEmitter(0L); // no timeout
        emittersByRecipient.computeIfAbsent(recipientId, k -> new CopyOnWriteArrayList<>()).add(emitter);
        emitter.onCompletion(() -> emittersByRecipient.getOrDefault(recipientId, new CopyOnWriteArrayList<>()).remove(emitter));
        emitter.onTimeout(() -> emittersByRecipient.getOrDefault(recipientId, new CopyOnWriteArrayList<>()).remove(emitter));
        return emitter;
    }

    /** Called from NotificationServiceImpl (or a listener on it) to push live updates. */
    public void push(Long recipientId, Notification notification) {
        var emitters = emittersByRecipient.get(recipientId);
        if (emitters == null) return;
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(notification);
            } catch (Exception e) {
                emitters.remove(emitter);
            }
        }
    }
}

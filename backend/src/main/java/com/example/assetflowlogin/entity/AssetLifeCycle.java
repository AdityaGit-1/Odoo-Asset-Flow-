package com.example.assetflowlogin.entity;

import com.example.assetflowlogin.enums.AssetStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "asset_lifecycles")
@Getter
@Setter
@NoArgsConstructor
public class AssetLifecycle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "asset_id", nullable = false)
    private Asset asset;

    @Enumerated(EnumType.STRING)
    @Column(name = "previous_status", nullable = false)
    private AssetStatus previousStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "new_status", nullable = false)
    private AssetStatus newStatus;

    @Column(length = 1000)
    private String remarks;

    @Column(name = "changed_at", nullable = false)
    private LocalDateTime changedAt;
}
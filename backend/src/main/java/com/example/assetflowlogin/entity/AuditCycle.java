package com.example.assetflowlogin.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

@Entity
@Table(name = "audit_cycles")
@Getter
@Setter
@NoArgsConstructor
public class AuditCycle extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "department_id")
    private Department department;

    private String location;

    @Column(nullable = false)
    private LocalDate startDate;

    @Column(nullable = false)
    private LocalDate endDate;

    private String status;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "audit_cycle_auditors", joinColumns = @JoinColumn(name = "cycle_id"))
    @Column(name = "auditor_id")
    private java.util.Set<Long> auditorIds = new java.util.HashSet<>();
}
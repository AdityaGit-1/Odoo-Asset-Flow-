package com.example.assetflowlogin.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import com.example.assetflowlogin.entity.ResourceBooking;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ResourceBookingRepository extends JpaRepository<ResourceBooking, Long> {

    /**
     * Detects overlapping bookings for a given asset within the requested time interval.
     * Excludes cancelled bookings from the check.
     */
    @Query("""
        SELECT rb FROM ResourceBooking rb
        WHERE rb.asset.id = :assetId
        AND rb.status != com.example.assetflowlogin.enums.BookingStatus.CANCELLED
        AND :requestedStart < rb.endTime
        AND :requestedEnd > rb.startTime
        """)
    List<ResourceBooking> findConflictingBookings(
        @Param("assetId") Long assetId,
        @Param("requestedStart") LocalDateTime requestedStart,
        @Param("requestedEnd") LocalDateTime requestedEnd
    );

    /**
     * Retrieves all active bookings for a specific asset.
     */
    @Query("""
        SELECT rb FROM ResourceBooking rb
        WHERE rb.asset.id = :assetId
        AND rb.status IN (
            com.example.assetflowlogin.enums.BookingStatus.UPCOMING,
            com.example.assetflowlogin.enums.BookingStatus.ONGOING
        )
        ORDER BY rb.startTime ASC
        """)
    List<ResourceBooking> findActiveBookingsByAssetId(@Param("assetId") Long assetId);

    /**
     * Retrieves all bookings for a specific user.
     */
    @Query("""
        SELECT rb FROM ResourceBooking rb
        WHERE rb.bookedBy.id = :userId
        ORDER BY rb.startTime DESC
        """)
    List<ResourceBooking> findByBookedByIdOrderByStartTimeDesc(@Param("userId") Long userId);
}
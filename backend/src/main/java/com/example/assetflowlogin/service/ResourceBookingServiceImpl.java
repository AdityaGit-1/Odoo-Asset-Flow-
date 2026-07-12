package com.example.assetflowlogin.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.assetflowlogin.dto.request.ResourceBookingRequestDTO;
import com.example.assetflowlogin.dto.response.ResourceBookingResponseDTO;
import com.example.assetflowlogin.entity.Asset;
import com.example.assetflowlogin.entity.ResourceBooking;
import com.example.assetflowlogin.entity.User;
import com.example.assetflowlogin.enums.BookingStatus;
import com.example.assetflowlogin.exceptions.AssetNotAvailableException;
import com.example.assetflowlogin.exceptions.BookingConflictException;
import com.example.assetflowlogin.repository.AssetRepository;
import com.example.assetflowlogin.repository.ResourceBookingRepository;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ResourceBookingServiceImpl implements ResourceBookingService {

    private final ResourceBookingRepository bookingRepository;
    private final AssetRepository assetRepository;

    @Override
    @Transactional
    public ResourceBookingResponseDTO bookResource(ResourceBookingRequestDTO dto, User currentUser) {
        Asset asset = assetRepository.findById(dto.assetId())
            .orElseThrow(() -> new AssetNotAvailableException("Asset not found with ID: " + dto.assetId()));

        List<ResourceBooking> conflicts = bookingRepository.findConflictingBookings(
            dto.assetId(), dto.startTime(), dto.endTime()
        );
        if (!conflicts.isEmpty()) {
            throw new BookingConflictException("Asset has an overlapping booking for the requested time range.");
        }

        ResourceBooking booking = ResourceBooking.builder()
            .asset(asset)
            .bookedBy(currentUser)
            .startTime(dto.startTime())
            .endTime(dto.endTime())
            .purpose(dto.purpose())
            .status(BookingStatus.UPCOMING)
            .build();

        ResourceBooking savedBooking = bookingRepository.save(booking);
        return mapToResponseDTO(savedBooking);
    }

    private ResourceBookingResponseDTO mapToResponseDTO(ResourceBooking booking) {
        return ResourceBookingResponseDTO.builder()
            .id(booking.getId())
            .assetId(booking.getAsset().getId())
            .assetName(booking.getAsset().getName())
            .bookedById(booking.getBookedBy().getId())
            .bookedByEmail(booking.getBookedBy().getEmail())
            .startTime(booking.getStartTime())
            .endTime(booking.getEndTime())
            .purpose(booking.getPurpose())
            .status(booking.getStatus())
            .build();
    }
}
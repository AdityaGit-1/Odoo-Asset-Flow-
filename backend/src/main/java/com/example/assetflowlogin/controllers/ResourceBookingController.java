package com.example.assetflowlogin.controllers;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.example.assetflowlogin.dto.request.ResourceBookingRequestDTO;
import com.example.assetflowlogin.dto.response.ResourceBookingResponseDTO;
import com.example.assetflowlogin.entity.User;
import com.example.assetflowlogin.service.ResourceBookingService;

@RestController
@RequestMapping("/api/bookings")
@RequiredArgsConstructor
public class ResourceBookingController {

    private final ResourceBookingService bookingService;

    @PostMapping
    public ResponseEntity<ResourceBookingResponseDTO> createBooking(
            @RequestBody ResourceBookingRequestDTO requestDTO
    ) {
        // Temporary fallback placeholder context to handle the User entity parameter 
        // until you bind your team's security principal/session hooks.
        User mockUser = new User(); 
        
        ResourceBookingResponseDTO response = bookingService.bookResource(requestDTO, mockUser);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
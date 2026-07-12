package com.example.assetflowlogin.service;

import com.example.assetflowlogin.dto.request.ResourceBookingRequestDTO;
import com.example.assetflowlogin.dto.response.ResourceBookingResponseDTO;
import com.example.assetflowlogin.entity.User;

public interface ResourceBookingService {
    ResourceBookingResponseDTO bookResource(ResourceBookingRequestDTO dto, User currentUser);
}
package com.example.assetflowlogin.dto.response;

import lombok.*;
import java.time.LocalDateTime;
import com.example.assetflowlogin.enums.BookingStatus;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ResourceBookingResponseDTO {
    private Long id;
    private Long assetId;
    private String assetName;
    private Long bookedById;
    private String bookedByEmail;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private String purpose;
    private BookingStatus status;
}
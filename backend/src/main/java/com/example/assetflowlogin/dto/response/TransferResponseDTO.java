package com.example.assetflowlogin.dto.response;

import lombok.*;
import java.time.LocalDateTime;
import com.example.assetflowlogin.entity.TransferStatus;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TransferResponseDTO {
    private Long id;
    private Long assetId;
    private String assetName;
    private Long senderId;
    private String senderEmail;
    private Long receiverId;
    private String receiverEmail;
    private TransferStatus status;
    private String reason;
    private LocalDateTime createdAt;
}
package com.assetflow.backend.service;

import org.springframework.stereotype.Service;

import java.security.SecureRandom;

/**
 * Pure OTP generation utility. Persistence of the generated OTP
 * (in EmailVerification / PasswordResetToken) is handled by AuthService,
 * keeping this class stateless and reusable.
 */
@Service
public class OtpService {

    private static final int OTP_LENGTH = 6;
    private static final SecureRandom RANDOM = new SecureRandom();

    /**
     * Generates a zero-padded 6-digit numeric OTP, e.g. "042917".
     */
    public String generateOtp() {
        int bound = (int) Math.pow(10, OTP_LENGTH);
        int value = RANDOM.nextInt(bound);
        return String.format("%0" + OTP_LENGTH + "d", value);
    }
}
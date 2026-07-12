package com.assetflow.backend.service;

public interface EmailService {

    /**
     * Sends the account-verification OTP after registration.
     */
    void sendVerificationEmail(String toEmail, String firstName, String otp);

    /**
     * Sends the OTP used to authorize a password reset.
     */
    void sendPasswordResetEmail(String toEmail, String firstName, String otp);
}
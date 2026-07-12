package com.example.assetflowlogin.exceptions;

/**
 * Thrown when an OTP supplied for email verification or password
 * reset does not match the one on record, or has already been used.
 */
public class InvalidOtpException extends RuntimeException {

    public InvalidOtpException(String message) {
        super(message);
    }

    public InvalidOtpException() {
        super("Invalid OTP provided.");
    }
}
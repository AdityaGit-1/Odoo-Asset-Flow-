package com.assetflow.backend.exception;

/**
 * Thrown when a JWT refresh token, OTP, or other time-bound token
 * has passed its expiry timestamp.
 */
public class TokenExpiredException extends RuntimeException {

    public TokenExpiredException(String message) {
        super(message);
    }

    public TokenExpiredException() {
        super("Token has expired.");
    }
}
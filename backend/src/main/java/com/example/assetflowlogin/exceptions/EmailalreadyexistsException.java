package com.example.assetflowlogin.exceptions;

/**
 * Thrown during registration when the supplied email is already
 * associated with an existing account.
 */
public class EmailAlreadyExistsException extends RuntimeException {

    public EmailAlreadyExistsException(String email) {
        super("An account already exists with email: " + email);
    }
}
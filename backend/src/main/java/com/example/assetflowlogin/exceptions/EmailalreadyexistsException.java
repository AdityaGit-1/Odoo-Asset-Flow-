package com.assetflow.backend.exception;

/**
 * Thrown during registration when the supplied email is already
 * associated with an existing account.
 */
public class EmailalreadyexistsException extends RuntimeException {

    public EmailalreadyexistsException(String email) {
        super("An account already exists with email: " + email);
    }
}
package com.example.assetflowlogin.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.BAD_REQUEST)
public class AssetNotAvailableException extends RuntimeException {
    public AssetNotAvailableException(String message) {
        super(message);
    }
}